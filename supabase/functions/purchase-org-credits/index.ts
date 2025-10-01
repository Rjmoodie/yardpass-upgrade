import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { org_id, package_id, custom_credits, promo_code } = await req.json();

    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`💳 Starting org credit purchase for org: ${org_id}`);

    // Ensure wallet exists (will validate owner/admin membership)
    const { data: walletId, error: ensureError } = await supabase.rpc(
      "ensure_org_wallet_exists",
      { p_org_id: org_id }
    );

    if (ensureError) {
      console.error("❌ Failed to ensure wallet:", ensureError);
      return new Response(JSON.stringify({ error: ensureError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve package or custom credits
    let credits: number;
    let price_cents: number;

    if (package_id) {
      const { data: pkg, error: pkgError } = await supabase
        .from("credit_packages")
        .select("credits, price_usd_cents")
        .eq("id", package_id)
        .eq("is_active", true)
        .single();

      if (pkgError || !pkg) {
        return new Response(JSON.stringify({ error: "Invalid package" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      credits = pkg.credits;
      price_cents = pkg.price_usd_cents;
    } else if (custom_credits && custom_credits > 0) {
      credits = custom_credits;
      price_cents = custom_credits; // 1 credit = 1 cent
    } else {
      return new Response(JSON.stringify({ error: "Package or credits required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create invoice using admin client to bypass RLS
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert({
        org_wallet_id: walletId,
        amount_usd_cents: price_cents,
        credits_purchased: credits,
        status: "pending",
        promo_code,
      })
      .select("id")
      .single();

    if (invoiceError || !invoice) {
      console.error("❌ Failed to create invoice:", invoiceError);
      return new Response(JSON.stringify({ error: "Failed to create invoice" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Stripe session
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: price_cents,
            product_data: {
              name: `Organization Credits`,
              description: `${credits.toLocaleString()} credits for your organization`,
            },
          },
        },
      ],
      success_url: `https://lovable.app/orgs/${org_id}/wallet?success=1`,
      cancel_url: `https://lovable.app/orgs/${org_id}/wallet?canceled=1`,
      metadata: {
        org_wallet_id: walletId,
        invoice_id: invoice.id,
        credits: String(credits),
        org_id: org_id,
        idempotency_key: crypto.randomUUID(),
      },
    });

    console.log(`✅ Stripe session created: ${session.id}`);

    return new Response(
      JSON.stringify({
        session_url: session.url,
        invoice_id: invoice.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});