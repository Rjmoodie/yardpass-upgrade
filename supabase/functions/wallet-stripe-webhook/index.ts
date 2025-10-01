// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

function requiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) return new Response("No signature", { status: 400 });

    const STRIPE_SECRET_KEY = requiredEnv("STRIPE_SECRET_KEY");
    const STRIPE_WEBHOOK_SECRET = requiredEnv("STRIPE_WEBHOOK_SECRET_WALLET");
    const SUPABASE_URL = requiredEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error(`[wallet-webhook:${requestId}] Signature verification failed:`, err?.message);
      return new Response(`Webhook Error: ${err?.message}`, { status: 400 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`[wallet-webhook:${requestId}] ${event.type} (${event.id})`);

    // Helper to fetch receipt URL from PI -> Charge
    async function getReceiptUrlFromPaymentIntent(piId: string | null | undefined): Promise<string | null> {
      if (!piId) return null;
      const pi = await stripe.paymentIntents.retrieve(piId);
      const chargeId = (pi.latest_charge as string) ?? null;
      if (!chargeId) return null;
      const charge = await stripe.charges.retrieve(chargeId);
      return (charge as any)?.receipt_url ?? null;
    }

    // De-dupe by Stripe event id
    const { data: existingEvt } = await sb
      .from("wallet_transactions")
      .select("id")
      .eq("idempotency_key", event.id)
      .maybeSingle();
    if (existingEvt) {
      console.log(`[wallet-webhook:${requestId}] Event already processed (idempotent).`);
      return new Response(JSON.stringify({ received: true, idempotent: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntentId = session.payment_intent as string | undefined;

        const meta = session.metadata || {};
        const invoiceId = meta.invoice_id ?? null;
        const walletId = meta.wallet_id ?? null;
        const creditsStr = meta.credits ?? null;

        if (!invoiceId || !walletId || !creditsStr) {
          console.error(`[wallet-webhook:${requestId}] Missing metadata (invoice_id/wallet_id/credits).`);
          break;
        }

        const credits = parseInt(creditsStr, 10);
        if (!Number.isFinite(credits) || credits <= 0) {
          console.error(`[wallet-webhook:${requestId}] Invalid credits: ${creditsStr}`);
          break;
        }

        const amountCents = session.amount_total ?? null;
        if (amountCents === null) {
          console.warn(`[wallet-webhook:${requestId}] amount_total is null; falling back to PI retrieval`);
        }

        const receiptUrl = (session as any).receipt_url || (await getReceiptUrlFromPaymentIntent(paymentIntentId));

        // Persist PI id on invoice for later refunds/disputes mapping
        if (paymentIntentId) {
          await sb.from("invoices").update({ stripe_payment_intent_id: paymentIntentId }).eq("id", invoiceId);
        }

        // Atomic apply
        const { error: applyErr } = await sb.rpc("wallet_apply_purchase", {
          p_invoice_id: invoiceId,
          p_wallet_id: walletId,
          p_credits: credits,
          p_usd_cents: amountCents ?? credits,
          p_receipt_url: receiptUrl,
          p_idempotency_key: event.id
        });
        if (applyErr) throw applyErr;

        console.log(`[wallet-webhook:${requestId}] Purchase applied: +${credits} credits to wallet ${walletId}`);
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const piId = pi.id;

        const { data: inv, error: invErr } = await sb
          .from("invoices")
          .select("id, wallet_id, credits_purchased, amount_usd_cents")
          .eq("stripe_payment_intent_id", piId)
          .maybeSingle();
        if (invErr) throw invErr;
        if (!inv) break;

        const receiptUrl = await getReceiptUrlFromPaymentIntent(piId);
        const credits = inv.credits_purchased;
        const amountCents = inv.amount_usd_cents ?? credits;

        const { error: applyErr } = await sb.rpc("wallet_apply_purchase", {
          p_invoice_id: inv.id,
          p_wallet_id: inv.wallet_id,
          p_credits: credits,
          p_usd_cents: amountCents,
          p_receipt_url: receiptUrl,
          p_idempotency_key: event.id
        });
        if (applyErr) throw applyErr;

        console.log(`[wallet-webhook:${requestId}] Purchase applied via PI: +${credits} credits`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = (charge.payment_intent as string) ?? null;
        if (!piId) break;

        const { data: inv, error: invErr } = await sb
          .from("invoices")
          .select("id, wallet_id")
          .eq("stripe_payment_intent_id", piId)
          .maybeSingle();
        if (invErr) throw invErr;
        if (!inv) {
          console.log(`[wallet-webhook:${requestId}] No invoice matched for refund (PI ${piId})`);
          break;
        }

        const refundCents = charge.amount_refunded ?? 0;
        if (refundCents <= 0) break;

        const { error: refErr } = await sb.rpc("wallet_apply_refund", {
          p_invoice_id: inv.id,
          p_wallet_id: inv.wallet_id,
          p_refund_usd_cents: refundCents,
          p_idempotency_key: event.id
        });
        if (refErr) throw refErr;

        // Freeze if negative
        await sb.rpc("wallet_freeze_if_negative", { p_wallet_id: inv.wallet_id });

        console.log(`[wallet-webhook:${requestId}] Refund applied: -${refundCents} cents (${refundCents} credits)`);
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId = (dispute.payment_intent as string) ?? (dispute.charge as string) ?? null;
        if (!piId) break;

        const { data: inv } = await sb
          .from("invoices")
          .select("id, wallet_id")
          .eq("stripe_payment_intent_id", piId)
          .maybeSingle();
        if (inv) {
          await sb.from("wallets").update({ status: "frozen" }).eq("id", inv.wallet_id);
          console.log(`[wallet-webhook:${requestId}] Wallet ${inv.wallet_id} frozen due to dispute`);
        }
        break;
      }

      default: {
        console.log(`[wallet-webhook:${requestId}] Unhandled type: ${event.type}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("[wallet-webhook] Error:", err?.message || err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});