import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2023-10-16",
  });

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_WALLET");
  if (!webhookSecret) {
    console.error("[wallet-webhook] STRIPE_WEBHOOK_SECRET_WALLET not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error(`[wallet-webhook] Signature verification failed:`, err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  console.log(`[wallet-webhook] Event ${event.type} - ${event.id}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { invoice_id, wallet_id, credits, idempotency_key } = session.metadata || {};

        if (!invoice_id || !wallet_id || !credits) {
          console.error("[wallet-webhook] Missing metadata in session");
          break;
        }

        console.log(`[wallet-webhook] Processing payment for invoice ${invoice_id}`);

        // Check idempotency
        const { data: existing } = await supabase
          .from("wallet_transactions")
          .select("*")
          .eq("idempotency_key", idempotency_key)
          .maybeSingle();

        if (existing) {
          console.log(`[wallet-webhook] Transaction already processed (idempotent)`);
          break;
        }

        // Mark invoice as paid
        const { error: invError } = await supabase
          .from("invoices")
          .update({
            status: "paid",
            receipt_url: session.receipt_url || session.url,
          })
          .eq("id", invoice_id);

        if (invError) throw invError;

        // Add credits via transaction
        const { error: txError } = await supabase
          .from("wallet_transactions")
          .insert({
            wallet_id,
            type: "purchase",
            credits_delta: parseInt(credits),
            usd_cents: session.amount_total,
            reference_type: "invoice",
            reference_id: invoice_id,
            memo: `Credit purchase via Stripe`,
            idempotency_key,
          });

        if (txError) throw txError;

        // Update wallet balance
        const { error: balError } = await supabase
          .from("wallets")
          .update({
            balance_credits: supabase.rpc("raw", {
              sql: `balance_credits + ${parseInt(credits)}`,
            }),
          })
          .eq("id", wallet_id);

        if (balError) {
          // If balance update fails, recompute from ledger
          await supabase.rpc("recompute_wallet_balance", { p_wallet: wallet_id });
        }

        console.log(`[wallet-webhook] Added ${credits} credits to wallet ${wallet_id}`);

        // TODO: Send receipt email
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const session_id = charge.metadata?.session_id;

        if (!session_id) break;

        const { data: invoice } = await supabase
          .from("invoices")
          .select("*, wallets!inner(*)")
          .eq("stripe_invoice_id", session_id)
          .single();

        if (!invoice) {
          console.log(`[wallet-webhook] No invoice found for refund`);
          break;
        }

        const refundCents = charge.amount_refunded;
        const refundCredits = -Math.floor(refundCents); // Negative to deduct

        // Create refund transaction
        await supabase.from("wallet_transactions").insert({
          wallet_id: invoice.wallet_id,
          type: "refund",
          credits_delta: refundCredits,
          usd_cents: -refundCents,
          reference_type: "invoice",
          reference_id: invoice.id,
          memo: `Stripe refund`,
        });

        // Recompute balance
        await supabase.rpc("recompute_wallet_balance", {
          p_wallet: invoice.wallet_id,
        });

        // Check if balance is negative -> freeze
        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance_credits")
          .eq("id", invoice.wallet_id)
          .single();

        if (wallet && wallet.balance_credits < 0) {
          await supabase
            .from("wallets")
            .update({ status: "frozen" })
            .eq("id", invoice.wallet_id);

          console.log(`[wallet-webhook] Wallet frozen due to negative balance`);
        }

        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const charge_id = dispute.charge;

        // Find invoice by charge
        const { data: invoice } = await supabase
          .from("invoices")
          .select("*")
          .eq("stripe_payment_intent_id", charge_id)
          .maybeSingle();

        if (invoice) {
          // Freeze wallet
          await supabase
            .from("wallets")
            .update({ status: "frozen" })
            .eq("id", invoice.wallet_id);

          console.log(`[wallet-webhook] Wallet frozen due to dispute`);
        }

        break;
      }

      default:
        console.log(`[wallet-webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[wallet-webhook] Error processing ${event.type}:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});