// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { corsHeaders } from "../_shared/cors.ts";

function requiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const requestId = crypto.randomUUID();

  try {
    const { org_id, package_id, custom_credits, promo_code } = await req.json();

    // Basic input validation
    if (!org_id) return json({ error: "org_id is required" }, 400);
    const hasPackage = !!package_id;
    const hasCustom = Number.isFinite(custom_credits) && custom_credits > 0;
    if ((hasPackage && hasCustom) || (!hasPackage && !hasCustom)) {
      return json({ error: "Provide either package_id OR custom_credits" }, 400);
    }

    // For custom credits, enforce sane bounds
    let custom = 0;
    if (hasCustom) {
      custom = Math.floor(Number(custom_credits));
      if (custom < 1000) return json({ error: "Minimum purchase is 1,000 credits" }, 400);
      if (custom % 100 !== 0) return json({ error: "Credits must be in increments of 100" }, 400);
      if (custom > 1_000_000) return json({ error: "Maximum purchase is 1,000,000 credits" }, 400);
    }

    // Env & clients
    const SUPABASE_URL = requiredEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = requiredEnv("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const STRIPE_SECRET_KEY = requiredEnv("STRIPE_SECRET_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    console.log(`💳 [${requestId}] org purchase start org=${org_id} user=${user.id}`);

    // Ensure wallet exists (and validate owner/admin membership)
    const { data: orgWalletId, error: ensureErr } = await supabase.rpc("ensure_org_wallet_exists", { p_org_id: org_id });
    if (ensureErr) {
      console.error(`❌ [${requestId}] ensure_org_wallet_exists error:`, ensureErr.message);
      return json({ error: "Not allowed or organization not found" }, 403);
    }

    // Resolve price & credits
    let credits: number;
    let price_cents: number;

    if (hasPackage) {
      const { data: pkg, error: pkgError } = await supabase
        .from("credit_packages")
        .select("id, credits, price_usd_cents, is_active")
        .eq("id", package_id)
        .single();

      if (pkgError || !pkg || !pkg.is_active) {
        return json({ error: "Invalid or inactive package" }, 400);
      }

      credits = pkg.credits;
      price_cents = pkg.price_usd_cents;
    } else {
      credits = custom;
      price_cents = custom; // 1 credit = 1 cent
    }

    // Sanitize promo code
    const promo = typeof promo_code === "string" ? promo_code.trim().slice(0, 64) : null;

    // Create a request idempotency key
    const requestKey = crypto.randomUUID();

    // Create invoice (org) - only use org_wallet_id, wallet_id is for individual users
    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .insert({
        org_wallet_id: orgWalletId,
        amount_usd_cents: price_cents,
        credits_purchased: credits,
        status: "pending",
        promo_code: promo,
      })
      .select("id")
      .single();

    if (invErr || !invoice) {
      console.error(`❌ [${requestId}] failed to create invoice:`, invErr?.message);
      return json({ error: "Failed to create invoice" }, 500);
    }

    // Stripe checkout session
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    const lineName = hasPackage
      ? `Organization Credits – Package`
      : `Organization Credits – Custom`;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: price_cents,
              product_data: {
                name: lineName,
                description: `${credits.toLocaleString()} credits for org ${org_id}`
              }
            }
          }
        ],
        success_url: `https://lovable.app/orgs/${org_id}/wallet?success=1`,
        cancel_url: `https://lovable.app/orgs/${org_id}/wallet?canceled=1`,
        metadata: {
          org_wallet_id: orgWalletId,
          invoice_id: invoice.id,
          credits: String(credits),
          org_id,
          request_id: requestKey
        }
      },
      {
        // Stripe idempotency ensures retries don't create multiple sessions
        idempotencyKey: `org-session:${org_id}:${invoice.id}:${requestKey}`
      }
    );

    console.log(`✅ [${requestId}] session ${session.id} for invoice ${invoice.id}`);

    return json({ session_url: session.url, invoice_id: invoice.id, request_id: requestKey }, 200);
  } catch (err: any) {
    console.error("❌ purchase-org-credits error:", err?.message || err);
    return json({ error: "Internal Server Error" }, 500);
  }
});
