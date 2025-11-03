import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Log immediately - this should always show up
  console.log("=== WEBHOOK CALLED ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  
  try {
    logStep("Webhook received", { method: req.method });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) {
      logStep("Missing STRIPE_SECRET_KEY");
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    if (!webhookSecret) {
      logStep("⚠️ WARNING: STRIPE_WEBHOOK_SECRET not configured!", {
        hint: "Get it from: Stripe Dashboard > Webhooks > Signing secret",
        dashboardUrl: "https://dashboard.stripe.com/test/webhooks"
      });
      throw new Error("STRIPE_WEBHOOK_SECRET not configured. Please add it in Supabase Dashboard > Settings > Edge Functions > Secrets");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      logStep("No Stripe signature found in request headers");
      throw new Error("No Stripe signature found");
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("✅ Event verified successfully", { type: event.type, id: event.id });
    } catch (err: any) {
      logStep("❌ Webhook signature verification failed", { 
        error: err.message,
        hint: "The STRIPE_WEBHOOK_SECRET might be incorrect or from a different webhook endpoint",
        currentSecretPrefix: webhookSecret.substring(0, 10) + "..."
      });
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    // Create Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      let stripeSessionId: string | null = null;
      let checkoutSessionId: string | null = null;
      let queryField: string = "stripe_session_id";
      let queryValue: string | null = null;
      
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        stripeSessionId = session.id;
        queryField = "stripe_session_id";
        queryValue = stripeSessionId;
        logStep("Processing checkout.session.completed", { stripeSessionId });
      } else if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // For embedded checkout, metadata contains the internal checkout_session_id
        checkoutSessionId = paymentIntent.metadata?.checkout_session_id || null;
        
        logStep("Processing payment_intent.succeeded", { 
          paymentIntentId: paymentIntent.id,
          checkoutSessionIdFromMetadata: checkoutSessionId,
          allMetadata: paymentIntent.metadata
        });
        
        if (checkoutSessionId) {
          // Query by the internal checkout_session_id field
          queryField = "checkout_session_id";
          queryValue = checkoutSessionId;
        } else {
          logStep("No checkout_session_id in payment_intent metadata, skipping");
          return new Response(JSON.stringify({ received: true, skipped: "no_session_id" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Find the order by the appropriate session ID field
      logStep("Querying order", { field: queryField, value: queryValue });
      
      const { data: order, error: orderError } = await supabaseService
        .from("orders")
        .select(`
          *,
          events!orders_event_id_fkey (
            title
          )
        `)
        .eq(queryField, queryValue)
        .maybeSingle();

      if (orderError) {
        logStep("Database error finding order", { 
          queryField,
          queryValue,
          error: orderError.message,
          code: orderError.code 
        });
        throw new Error(`Database error: ${orderError.message}`);
      }

      if (!order) {
        logStep("Order not found", { 
          queryField,
          queryValue,
          eventType: event.type
        });
        throw new Error(`Order not found for ${queryField}: ${queryValue}`);
      }

      logStep("Order found", { orderId: order.id, status: order.status });

      // If already processed, skip
      if (order.status === 'paid') {
        logStep("Order already processed", { orderId: order.id });
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Call process-payment to handle ticket creation and email sending
      // Pass the stripe_session_id (which process-payment expects)
      const sessionIdForProcessing = stripeSessionId || order.stripe_session_id;
      
      logStep("Calling process-payment function", { 
        sessionId: sessionIdForProcessing,
        orderId: order.id 
      });
      
      const processPaymentResponse = await supabaseService.functions.invoke('process-payment', {
        body: { sessionId: sessionIdForProcessing }
      });

      if (processPaymentResponse.error) {
        logStep("process-payment failed", { error: processPaymentResponse.error });
        // Mark as paid anyway so user can manually retry
        await supabaseService
          .from("orders")
          .update({
            status: 'paid',
            paid_at: new Date().toISOString()
          })
          .eq("id", order.id);
      } else {
        logStep("process-payment succeeded", { 
          orderId: order.id,
          ticketsCreated: processPaymentResponse.data?.order?.tickets_count
        });
      }

      logStep("Payment processed successfully", { orderId: order.id });

    } else {
      logStep("Unhandled webhook event", { type: event.type });
    }

    logStep("Webhook processed successfully", { type: event.type });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});