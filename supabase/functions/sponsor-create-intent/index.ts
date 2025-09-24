import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  const t0 = performance.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1) Check circuit breaker
    const { data: cb } = await supabase.rpc('check_circuit_breaker', { p_service_id: 'stripe_api' });
    if (!cb?.can_proceed) {
      return new Response(JSON.stringify({ 
        error: 'Stripe API temporarily unavailable',
        correlation_id: correlationId 
      }), { 
        status: 503, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2023-10-16",
    });

    // Get the Authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { packageId, sponsorId, notes } = await req.json();

    console.log('Creating payment intent for package:', packageId, 'sponsor:', sponsorId);

    // 1) Load package + event + organizer connect
    const { data: pkg, error: pkgErr } = await supabase
      .from("sponsorship_packages")
      .select("id, event_id, title, price_cents, currency, inventory, sold, is_active")
      .eq("id", packageId)
      .single();

    if (pkgErr || !pkg || !pkg.is_active) {
      console.error('Package error:', pkgErr);
      return new Response("Package not available", { status: 400 });
    }

    if (pkg.sold >= pkg.inventory) {
      return new Response("Sold out", { status: 400 });
    }

    const { data: ev } = await supabase
      .from("events")
      .select("id, owner_context_type, owner_context_id, title, start_at")
      .eq("id", pkg.event_id)
      .single();

    if (!ev) {
      return new Response("Event not found", { status: 404 });
    }

    const { data: conn } = await supabase
      .from("event_connect")
      .select("stripe_connect_account_id")
      .eq("event_id", ev.id)
      .maybeSingle();

    if (!conn?.stripe_connect_account_id) {
      return new Response("Organizer payout account not set", { status: 400 });
    }

    // 2) Calculate platform fee
    const feeBps = Number(Deno.env.get("PLATFORM_FEE_BPS") || "1000"); // 10% default
    const applicationFeeCents = Math.floor((pkg.price_cents * feeBps) / 10000);

    // 3) Create order row
    const transferGroup = `sp_${crypto.randomUUID()}`;
    const { data: order, error: ordErr } = await supabase
      .from("sponsorship_orders")
      .insert({
        package_id: pkg.id,
        sponsor_id: sponsorId,
        event_id: ev.id,
        amount_cents: pkg.price_cents,
        currency: pkg.currency,
        status: "requires_payment",
        application_fee_cents: applicationFeeCents,
        transfer_group: transferGroup,
      })
      .select("*")
      .single();

    if (ordErr) {
      console.error('Order creation error:', ordErr);
      return new Response("Order create failed", { status: 500 });
    }

    // 4) Create PaymentIntent with resilience
    let intent;
    try {
      intent = await stripe.paymentIntents.create({
        amount: pkg.price_cents,
        currency: pkg.currency,
        description: `Sponsorship: ${ev.title} • ${pkg.title}`,
        metadata: {
          event_id: ev.id,
          package_id: pkg.id,
          order_id: order.id,
          transfer_group: transferGroup,
          correlation_id: correlationId,
        },
        automatic_payment_methods: { enabled: true },
      });

      // 5) Success - close circuit breaker
      await supabase.rpc('update_circuit_breaker_state', { 
        p_service_id: 'stripe_api', 
        p_success: true 
      });

    } catch (stripeError) {
      // Open/increment circuit breaker
      await supabase.rpc('update_circuit_breaker_state', { 
        p_service_id: 'stripe_api', 
        p_success: false, 
        p_error_message: (stripeError as any).message 
      });

      // Enqueue to DLQ for later retry
      await supabase.rpc('dlq_enqueue_webhook', {
        p_correlation_id: correlationId,
        p_webhook_type: 'stripe_outbound',
        p_payload: { 
          op: 'create_payment_intent', 
          package_id: pkg.id, 
          order_id: order.id,
          amount: pkg.price_cents 
        },
        p_original_timestamp: new Date().toISOString(),
        p_failure_reason: (stripeError as any).message?.slice(0, 500) || 'unknown'
      });

      throw stripeError;
    }

    await supabase
      .from("sponsorship_orders")
      .update({ stripe_payment_intent_id: intent.id })
      .eq("id", order.id);

    console.log(`[${correlationId}] Payment intent created:`, intent.id);

    const response = { 
      clientSecret: intent.client_secret,
      orderId: order.id,
      correlation_id: correlationId
    };

    // 6) Log successful request
    await supabase.rpc('log_request', {
      p_correlation_id: correlationId,
      p_source_type: 'edge_function',
      p_function_name: 'sponsor-create-intent',
      p_http_method: 'POST',
      p_url: 'stripe:paymentIntents.create',
      p_headers: Object.fromEntries(req.headers.entries()),
      p_body: { packageId, sponsorId, notes },
      p_response_status: 200,
      p_response_body: { order_id: order.id, intent_id: intent.id },
      p_execution_time_ms: Math.round(performance.now() - t0),
      p_error_message: null
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });

  } catch (error) {
    console.error(`[${correlationId}] Error in sponsor-create-intent:`, error);
    
    // Log the error
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    try {
      await supabase.rpc('log_request', {
        p_correlation_id: correlationId,
        p_source_type: 'edge_function',
        p_function_name: 'sponsor-create-intent',
        p_http_method: 'POST',
        p_url: '/sponsor-create-intent',
        p_headers: Object.fromEntries(req.headers.entries()),
        p_body: {},
        p_response_status: 500,
        p_response_body: { error: error.message },
        p_execution_time_ms: Math.round(performance.now() - t0),
        p_error_message: error.message
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        error: (error as any).message,
        correlation_id: correlationId
      }),
      {
        headers: { ...corsHeaders, "content-type": "application/json" },
        status: 500,
      }
    );
  }
});