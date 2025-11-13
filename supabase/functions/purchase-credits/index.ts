import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const idempotencyKey = req.headers.get("Idempotency-Key");

    if (!authHeader) throw new Error("No authorization header");
    if (!idempotencyKey) throw new Error("Idempotency-Key header required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { package_id, custom_credits, promo_code } = body;

    console.log(`[purchase-credits] User ${user.id}, package ${package_id || custom_credits}`);

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check idempotency
    const { data: existing } = await supabaseService
      .from("wallet_transactions")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      console.log(`[purchase-credits] Idempotent request detected`);
      const { data: invoice } = await supabaseService
        .from("invoices")
        .select("*")
        .eq("id", existing.reference_id)
        .single();

      return new Response(
        JSON.stringify({
          invoice_id: invoice.id,
          status: invoice.status,
          receipt_url: invoice.receipt_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get package or validate custom
    let credits = custom_credits;
    let price_usd_cents = custom_credits;

    if (package_id) {
      const { data: pkg, error: pkgError } = await supabase
        .from("credit_packages")
        .select("*")
        .eq("id", package_id)
        .eq("is_active", true)
        .single();

      if (pkgError || !pkg) throw new Error("Invalid package");

      credits = pkg.credits;
      price_usd_cents = pkg.price_usd_cents;
    }

    if (credits < 1000) {
      throw new Error("Minimum purchase is 1000 credits ($10)");
    }

    // Apply promo if provided
    let discount = 0;
    if (promo_code) {
      const { data: promo } = await supabaseService
        .from("promos")
        .select("*")
        .eq("code", promo_code)
        .gte("ends_at", new Date().toISOString())
        .single();

      if (promo) {
        if (promo.discount_type === "percent") {
          discount = Math.floor((price_usd_cents * promo.value) / 100);
        } else if (promo.discount_type === "amount") {
          discount = promo.value;
        } else if (promo.discount_type === "extra_credits") {
          credits += promo.value;
        }
      }
    }

    const finalAmount = Math.max(price_usd_cents - discount, 0);

    // Ensure wallet exists (using authenticated user's RPC)
    const { data: walletId, error: walletError } = await supabase.rpc("ensure_wallet_exists_for_auth_user");

    if (walletError) {
      console.error(`[purchase-credits] Failed to ensure wallet:`, walletError);
      throw new Error("Failed to initialize wallet");
    }

    const { data: wallet } = await supabaseService
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Create invoice
    const { data: invoice, error: invError } = await supabaseService
      .from("invoices")
      .insert({
        wallet_id: wallet.id,
        amount_usd_cents: finalAmount,
        credits_purchased: credits,
        promo_code,
        tax_usd_cents: 0,
        status: "pending",
        purchased_by_user_id: user.id, // Track who purchased
      })
      .select()
      .single();

    if (invError) throw invError;

    // Create Stripe checkout session
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${credits.toLocaleString()} Liventix Credits`,
              description: `Prepaid ad credits for Liventix campaigns`,
            },
            unit_amount: finalAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${Deno.env.get("PUBLIC_APP_URL") || "http://localhost:8080"}/wallet/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get("PUBLIC_APP_URL") || "http://localhost:8080"}/wallet`,
      billing_address_collection: 'required',
      
      // Fraud prevention: Enable 3D Secure
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
        },
      },
      
      metadata: {
        invoice_id: invoice.id,
        wallet_id: wallet.id,
        credits,
        idempotency_key: idempotencyKey,
        risk_context: 'wallet_topup',
      },
      
      // Fraud prevention: Add payment intent metadata
      payment_intent_data: {
        description: `${credits.toLocaleString()} Liventix ad credits`,
        metadata: {
          user_id: user.id,
          wallet_id: wallet.id,
          credits_purchased: credits,
        },
      },
    });

    // Update invoice with Stripe session
    await supabaseService
      .from("invoices")
      .update({
        stripe_payment_intent_id: session.payment_intent as string,
        stripe_invoice_id: session.id,
      })
      .eq("id", invoice.id);

    console.log(`[purchase-credits] Created Stripe session ${session.id}`);

    return new Response(
      JSON.stringify({
        session_url: session.url,
        invoice_id: invoice.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[purchase-credits] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});