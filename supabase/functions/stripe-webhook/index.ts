import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { enqueueWithDLQ } from "../_shared/queue-utils.ts";
import { createScopedLogger } from "../_shared/logger.ts";

const logger = createScopedLogger('stripe-webhook');

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
      let order: any = null;
      let orderError: any = null;
      
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        stripeSessionId = session.id;
        queryField = "stripe_session_id";
        queryValue = stripeSessionId;
        logStep("Processing checkout.session.completed", { stripeSessionId });
        
        // Find the order by the appropriate session ID field
        logStep("Querying order", { field: queryField, value: queryValue });
        
        // Query public.orders view (with service_role grants)
        const { data: orderData, error: orderErrorData } = await supabaseService
          .from("orders")
          .select("*")
          .eq(queryField, queryValue)
          .maybeSingle();
        
        order = orderData;
        orderError = orderErrorData;
      } else if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentIntentId = paymentIntent.id;
        
        // For embedded checkout, metadata contains the internal checkout_session_id
        checkoutSessionId = paymentIntent.metadata?.checkout_session_id || null;
        
        logStep("Processing payment_intent.succeeded", { 
          paymentIntentId: paymentIntentId,
          checkoutSessionIdFromMetadata: checkoutSessionId,
          allMetadata: paymentIntent.metadata
        });
        
        // Try to find order by stripe_payment_intent_id first (most reliable)
        logStep("Querying order by stripe_payment_intent_id", { paymentIntentId: paymentIntentId });
        const { data: orderByPI, error: errorByPI } = await supabaseService
          .from("orders")
          .select("*")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .maybeSingle();
        
        if (orderByPI) {
          order = orderByPI;
          logStep("Order found by stripe_payment_intent_id", { orderId: order.id });
          queryField = "stripe_payment_intent_id";
          queryValue = paymentIntentId;
        } else if (checkoutSessionId) {
          // Fallback: Query by the internal checkout_session_id field
          logStep("Order not found by payment_intent_id, trying checkout_session_id", { checkoutSessionId });
          queryField = "checkout_session_id";
          queryValue = checkoutSessionId;
          
          const { data: orderBySession, error: errorBySession } = await supabaseService
            .from("orders")
            .select("*")
            .eq(queryField, queryValue)
            .maybeSingle();
          
          order = orderBySession;
          orderError = errorBySession;
        } else {
          logStep("No checkout_session_id in payment_intent metadata and no order found by payment_intent_id", {
            paymentIntentId: paymentIntentId
          });
          return new Response(JSON.stringify({ received: true, skipped: "no_order_found" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      logStep("Order query result", {
        hasOrder: !!order,
        orderId: order?.id,
        hasError: !!orderError,
        errorCode: orderError?.code,
        errorMessage: orderError?.message
      });

      if (orderError) {
        logStep("Database error finding order", { 
          queryField,
          queryValue,
          error: orderError.message,
          code: orderError.code,
          details: orderError.details,
          hint: orderError.hint
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
      
      // Fetch event title separately
      const { data: eventData } = await supabaseService
        .from("events")
        .select("title")
        .eq("id", order.event_id)
        .maybeSingle();
      
      if (eventData) {
        order.events = eventData;
      }

      logStep("Order found", { orderId: order.id, status: order.status });

      // Mark checkout session as completed (for feed ranking analytics)
      if (stripeSessionId) {
        const { error: checkoutError } = await supabaseService.rpc('complete_checkout_session', {
          p_stripe_session_id: stripeSessionId
        });
        
        if (checkoutError) {
          logStep("Warning: Could not mark checkout as completed", { 
            error: checkoutError.message,
            stripeSessionId,
            note: "This is non-critical - order processing will continue"
          });
        } else {
          logStep("Checkout session marked as completed", { stripeSessionId });
        }
      }

      // If already processed, skip
      if (order.status === 'paid') {
        logStep("Order already processed", { orderId: order.id });
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 🔒 ATOMIC UPDATE: Mark as processing to prevent race conditions
      // This prevents duplicate webhook events from processing the same order twice
      const { data: updateResult, error: updateError } = await supabaseService
        .from("orders")
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq("id", order.id)
        .eq("status", "pending") // Only update if still pending
        .select("id")
        .maybeSingle();

      if (updateError) {
        logStep("Error updating order status", { error: updateError.message });
        throw new Error(`Failed to update order: ${updateError.message}`);
      }

      if (!updateResult) {
        logStep("Order already being processed by another webhook", { 
          orderId: order.id,
          hint: "This is expected when Stripe sends both checkout.session.completed and payment_intent.succeeded"
        });
        return new Response(JSON.stringify({ 
          received: true, 
          skipped: "already_processing" 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      logStep("Order status updated to 'paid', proceeding with ticket creation", { orderId: order.id });

      // 🗺️ Store user location from billing address (for guest checkout & analytics)
      if (order.user_id && event.type === "checkout.session.completed") {
        try {
          const session = event.data.object as Stripe.Checkout.Session;
          
          // Fetch full session with customer details
          const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['customer']
          });
          
          const customer = fullSession.customer as Stripe.Customer | null;
          const billingAddress = customer?.address;
          
          if (billingAddress) {
            const locationData = {
              city: billingAddress.city || null,
              state: billingAddress.state || null,
              country: billingAddress.country || null,
              postal_code: billingAddress.postal_code || null,
              line1: billingAddress.line1 || null,
            };
            
            logStep("Storing user location from billing address", { 
              userId: order.user_id, 
              city: locationData.city,
              country: locationData.country
            });
            
            // Update user_profiles with location
            const { error: locationError } = await supabaseService
              .from("user_profiles")
              .update({ location: JSON.stringify(locationData) })
              .eq("user_id", order.user_id);
            
            if (locationError) {
              logStep("⚠️ Failed to store location", { error: locationError.message });
              // Don't throw - location storage is non-critical
            } else {
              logStep("✅ Location stored successfully");
            }
          }
        } catch (locationErr: any) {
          logStep("⚠️ Error storing location", { error: locationErr.message });
          // Don't throw - location storage is non-critical
        }
      }

      // Call process-payment to handle ticket creation and email sending
      // For Payment Intents, pass paymentIntentId; for Checkout Sessions, pass sessionId
      let processPaymentBody: any = {};
      
      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        processPaymentBody = { paymentIntentId: paymentIntent.id };
        logStep("Calling process-payment function with paymentIntentId", { 
          paymentIntentId: paymentIntent.id,
          orderId: order.id 
        });
      } else {
        const sessionIdForProcessing = stripeSessionId || order.stripe_session_id;
        processPaymentBody = { sessionId: sessionIdForProcessing };
        logStep("Calling process-payment function with sessionId", { 
          sessionId: sessionIdForProcessing,
          orderId: order.id 
        });
      }
      
      const processPaymentResponse = await supabaseService.functions.invoke('process-payment', {
        body: processPaymentBody
      });

      if (processPaymentResponse.error) {
        logStep("process-payment failed", { error: processPaymentResponse.error });
        // Status already marked as 'paid' above, no need to update again
      } else {
        logStep("process-payment succeeded", { 
          orderId: order.id,
          ticketsCreated: processPaymentResponse.data?.order?.tickets_count
        });
      }

      logStep("Payment processed successfully", { orderId: order.id });

    } else if (event.type === "charge.refunded") {
      // ============================================================================
      // TICKET REFUNDS - Automatic Processing
      // ============================================================================
      
      logStep("🔄 Refund event received", { eventId: event.id });
      
      const charge = event.data.object as Stripe.Charge;
      const piId = (charge.payment_intent as string) ?? null;
      
      if (!piId) {
        logStep("No payment intent ID in refund event");
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Find ticket order by payment intent
      const { data: order, error: orderErr } = await supabaseService
        .from("orders")
        .select("id, user_id, event_id, total_cents, contact_email")
        .eq("stripe_payment_intent_id", piId)
        .maybeSingle();

      if (orderErr || !order) {
        logStep("No ticket order found for refund (might be wallet purchase)", { 
          paymentIntentId: piId 
        });
        // Not an error - could be a wallet purchase refunded via wallet-webhook
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const refundId = charge.refund 
        ? (typeof charge.refund === 'string' ? charge.refund : (charge.refund as any).id)
        : `refund_${event.id}`;
      const refundCents = charge.amount_refunded ?? 0;

      logStep("Processing ticket refund", { 
        orderId: order.id, 
        refundCents,
        stripeRefundId: refundId,
        stripeEventId: event.id 
      });

      // ✅ Process refund via RPC (idempotent via stripe_refund_id)
      const { data: refundResult, error: refundErr } = await supabaseService
        .rpc('process_ticket_refund', {
          p_order_id: order.id,
          p_refund_amount_cents: refundCents,
          p_stripe_refund_id: refundId,
          p_stripe_event_id: event.id,
          p_reason: 'Stripe refund',
          p_refund_type: 'admin',
          p_initiated_by: null
        });

      if (refundErr) {
        logStep("❌ Refund processing failed", { error: refundErr.message });
        throw new Error(`Refund processing failed: ${refundErr.message}`);
      }

      // Check if refund was actually processed or already done
      if (refundResult?.status === 'already_processed') {
        logStep("✅ Refund already processed (idempotency)", { 
          stripeRefundId: refundId 
        });
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (refundResult?.status === 'no_refundable_tickets') {
        logStep("⚠️ No tickets to refund (all redeemed)", { 
          orderId: order.id 
        });
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      logStep("✅ Refund processed successfully", { 
        orderId: order.id,
        ticketsRefunded: refundResult?.tickets_refunded,
        inventoryReleased: refundResult?.inventory_released
      });

      // ✅ Send refund confirmation email (webhook-only, single source)
      try {
        const emailResponse = await supabaseService.functions.invoke('send-refund-confirmation', {
          body: {
            order_id: order.id,
            email: order.contact_email,
            refund_amount: refundCents / 100,
            tickets_refunded: refundResult?.tickets_refunded,
            event_title: refundResult?.event_title,
            reason: 'Refund processed'
          }
        });

        if (emailResponse.error) {
          logStep("⚠️ Refund email failed (non-critical)", { 
            error: emailResponse.error 
          });
        } else {
          logStep("✅ Refund confirmation email sent", { 
            emailId: emailResponse.data?.id 
          });
        }
      } catch (emailErr) {
        logStep("⚠️ Email error (non-critical)", { error: emailErr });
      }

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