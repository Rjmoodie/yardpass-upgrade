/**
 * Stripe Webhook - STANDALONE VERSION
 * 
 * This is a standalone version with all shared utilities inlined.
 * Use this for Dashboard deployment (which doesn't bundle _shared/).
 * 
 * NEW FEATURES vs existing:
 * - Enqueues failed webhooks to webhook_retry_queue for automatic retry
 * - Returns 200 OK even on errors (Stripe won't retry, we handle retries internally)
 * - Structured logging with context
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ============================================================================
// INLINED SHARED UTILITIES
// ============================================================================

// Logger
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function logWithContext(level: 'info' | 'warn' | 'error' | 'debug', message: string, context: { feature: string; requestId?: string; userId?: string; operation?: string; metadata?: Record<string, unknown> }): void {
  const logEntry = { level, message, feature: context.feature, requestId: context.requestId || generateRequestId(), userId: context.userId, operation: context.operation, timestamp: new Date().toISOString(), ...context.metadata };
  const logString = JSON.stringify(logEntry);
  switch (level) {
    case 'error': console.error(logString); break;
    case 'warn': console.warn(logString); break;
    case 'debug': if (Deno.env.get('DEBUG') === 'true') console.debug(logString); break;
    default: console.log(logString);
  }
}

function createScopedLogger(feature: string) {
  return {
    info: (message: string, metadata?: Record<string, unknown>) => logWithContext('info', message, { feature, metadata }),
    warn: (message: string, metadata?: Record<string, unknown>) => logWithContext('warn', message, { feature, metadata }),
    error: (message: string, error?: Error, metadata?: Record<string, unknown>) => logWithContext('error', message, { feature, metadata: { ...metadata, error: error?.message, stack: error?.stack } }),
    debug: (message: string, metadata?: Record<string, unknown>) => logWithContext('debug', message, { feature, metadata }),
  };
}

// Queue utilities - Enqueue with DLQ
async function enqueueWithDLQ(
  supabaseClient: any,
  queueTable: 'email_queue' | 'webhook_retry_queue',
  item: Record<string, unknown>,
  options: { maxAttempts?: number; initialDelayMs?: number; metadata?: Record<string, unknown> } = {}
): Promise<string> {
  const { maxAttempts = 5, initialDelayMs = 0, metadata = {} } = options;
  const nextRetryAt = initialDelayMs > 0 ? new Date(Date.now() + initialDelayMs).toISOString() : new Date().toISOString();
  const { data, error } = await supabaseClient.from(queueTable).insert({
    ...item,
    max_attempts: maxAttempts,
    status: 'pending',
    next_retry_at: nextRetryAt,
    attempts: 0,
    metadata: { ...metadata, enqueued_at: new Date().toISOString() },
  }).select('id').single();
  if (error) throw new Error(`Failed to enqueue item: ${error.message}`);
  return data.id;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

const logger = createScopedLogger('stripe-webhook');

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  console.log("=== WEBHOOK CALLED ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  
  let eventId: string | null = null;
  let eventBody: string | null = null;
  let eventHeaders: Record<string, string> = {};
  let eventType: string | null = null;

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
    
    // Store body and headers BEFORE processing (for DLQ if needed)
    eventBody = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    // Store headers for retry queue
    eventHeaders = {
      'stripe-signature': signature || '',
      'content-type': req.headers.get('content-type') || 'application/json',
    };

    if (!signature) {
      logStep("No Stripe signature found in request headers");
      throw new Error("No Stripe signature found");
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(eventBody, signature, webhookSecret);
      eventId = event.id;
      eventType = event.type;
      logStep("✅ Event verified successfully", { type: event.type, id: event.id });
    } catch (err: any) {
      logStep("❌ Webhook signature verification failed", { 
        error: err.message,
        hint: "The STRIPE_WEBHOOK_SECRET might be incorrect or from a different webhook endpoint",
        currentSecretPrefix: webhookSecret.substring(0, 10) + "..."
      });
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 🔒 IDEMPOTENCY CHECK: Prevent duplicate processing
    const correlationId = crypto.randomUUID();
    const startTime = Date.now();

    const { data: existingEvent, error: checkError } = await supabaseService
      .from("stripe_webhook_events")
      .select("id, processed_at, success, error_message")
      .eq("stripe_event_id", event.id)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      logStep("⚠️ Error checking idempotency", { error: checkError.message });
    }

    if (existingEvent) {
      logStep("✅ Event already processed (idempotency)", {
        stripeEventId: event.id,
        processedAt: existingEvent.processed_at,
        success: existingEvent.success,
        errorMessage: existingEvent.error_message
      });
      return new Response(JSON.stringify({
        received: true,
        already_processed: true,
        correlation_id: correlationId
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Record event processing start
    const { error: insertError } = await supabaseService
      .from("stripe_webhook_events")
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        correlation_id: correlationId,
        payload_snapshot: {
          type: event.type,
          livemode: event.livemode,
          created: event.created
        },
        success: false,
        processed_at: new Date().toISOString()
      });

    if (insertError) {
      logStep("⚠️ Failed to record webhook event", { error: insertError.message });
    }

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
        checkoutSessionId = paymentIntent.metadata?.checkout_session_id || null;
        logStep("Processing payment_intent.succeeded", {
          paymentIntentId: paymentIntent.id,
          checkoutSessionIdFromMetadata: checkoutSessionId,
          allMetadata: paymentIntent.metadata
        });
        if (checkoutSessionId) {
          queryField = "checkout_session_id";
          queryValue = checkoutSessionId;
        } else {
          logStep("No checkout_session_id in payment_intent metadata, skipping");
          return new Response(JSON.stringify({ received: true, skipped: "no_session_id" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      logStep("Querying order", { field: queryField, value: queryValue });
      
      const { data: order, error: orderError } = await supabaseService
        .from("orders")
        .select("*")
        .eq(queryField, queryValue)
        .maybeSingle();

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
        logStep("Order not found", { queryField, queryValue, eventType: event.type });
        throw new Error(`Order not found for ${queryField}: ${queryValue}`);
      }
      
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
          headers: { "Content-Type": "application/json" }
        });
      }

      // 🔒 ATOMIC UPDATE: Mark as processing to prevent race conditions
      const { data: updateResult, error: updateError } = await supabaseService
        .from("orders")
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq("id", order.id)
        .eq("status", "pending")
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
          headers: { "Content-Type": "application/json" }
        });
      }

      logStep("Order status updated to 'paid', proceeding with ticket creation", { orderId: order.id });

      // 🗺️ Store user location from billing address
      if (order.user_id && event.type === "checkout.session.completed") {
        try {
          const session = event.data.object as Stripe.Checkout.Session;
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
            
            const { error: locationError } = await supabaseService
              .from("user_profiles")
              .update({ location: JSON.stringify(locationData) })
              .eq("user_id", order.user_id);
            
            if (locationError) {
              logStep("⚠️ Failed to store location", { error: locationError.message });
            } else {
              logStep("✅ Location stored successfully");
            }
          }
        } catch (locationErr: any) {
          logStep("⚠️ Error storing location", { error: locationErr.message });
        }
      }

      // Call process-payment to handle ticket creation and email sending
      const sessionIdForProcessing = stripeSessionId || order.stripe_session_id;
      
      logStep("Calling process-payment function", {
        sessionId: sessionIdForProcessing,
        orderId: order.id,
        correlationId
      });
      
      const processPaymentResponse = await supabaseService.functions.invoke('process-payment', {
        body: { sessionId: sessionIdForProcessing, correlationId }
      });

      if (processPaymentResponse.error) {
        logStep("process-payment failed", { error: processPaymentResponse.error });
      } else {
        logStep("process-payment succeeded", {
          orderId: order.id,
          ticketsCreated: processPaymentResponse.data?.order?.tickets_count
        });
      }

      logStep("Payment processed successfully", { orderId: order.id, correlationId });

      // Update webhook event record as successful
      const processingDuration = Date.now() - startTime;
      await supabaseService
        .from("stripe_webhook_events")
        .update({
          success: true,
          order_id: order.id,
          checkout_session_id: stripeSessionId || checkoutSessionId,
          processing_duration_ms: processingDuration
        })
        .eq("stripe_event_id", event.id);

    } else if (event.type === "charge.refunded") {
      logStep("🔄 Refund event received", { eventId: event.id });

      const charge = event.data.object as Stripe.Charge;
      const piId = (charge.payment_intent as string) ?? null;
      
      if (!piId) {
        logStep("No payment intent ID in refund event");
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      const { data: order, error: orderErr } = await supabaseService
        .from("orders")
        .select("id, user_id, event_id, total_cents, contact_email")
        .eq("stripe_payment_intent_id", piId)
        .maybeSingle();

      if (orderErr || !order) {
        logStep("No ticket order found for refund (might be wallet purchase)", { paymentIntentId: piId });
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
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

      const { data: refundResult, error: refundErr } = await supabaseService.rpc('process_ticket_refund', {
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

      if (refundResult?.status === 'already_processed') {
        logStep("✅ Refund already processed (idempotency)", { stripeRefundId: refundId });
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (refundResult?.status === 'no_refundable_tickets') {
        logStep("⚠️ No tickets to refund (all redeemed)", { orderId: order.id });
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      logStep("✅ Refund processed successfully", {
        orderId: order.id,
        ticketsRefunded: refundResult?.tickets_refunded,
        inventoryReleased: refundResult?.inventory_released,
        correlationId
      });

      // Update webhook event record as successful
      const processingDuration = Date.now() - startTime;
      await supabaseService
        .from("stripe_webhook_events")
        .update({
          success: true,
          order_id: order.id,
          processing_duration_ms: processingDuration
        })
        .eq("stripe_event_id", event.id);

      // Send refund confirmation email
      try {
        const emailResponse = await supabaseService.functions.invoke('send-refund-confirmation', {
          body: {
            order_id: order.id,
            email: order.contact_email,
            refund_amount: refundCents / 100,
            tickets_refunded: refundResult?.tickets_refunded,
            event_title: refundResult?.event_title,
            reason: 'Refund processed',
            correlationId
          }
        });

        if (emailResponse.error) {
          logStep("⚠️ Refund email failed (non-critical)", { error: emailResponse.error });
        } else {
          logStep("✅ Refund confirmation email sent", { emailId: emailResponse.data?.id });
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
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage, eventId });
    
    // 🔄 NEW: Enqueue failed webhook to retry queue
    try {
      const supabaseService = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Try to parse event from body if we have it
      let payload: any = null;
      if (eventBody) {
        try {
          payload = JSON.parse(eventBody);
        } catch {
          payload = { raw_body: eventBody };
        }
      }

      // Enqueue for retry (only if we have an event ID to avoid duplicates)
      if (eventId) {
        await enqueueWithDLQ(
          supabaseService,
          'webhook_retry_queue',
          {
            webhook_type: 'stripe',
            event_id: eventId,
            event_type: eventType || 'unknown',
            payload: payload || { error: 'failed_to_parse' },
            headers: eventHeaders,
            error_message: errorMessage,
            correlation_id: crypto.randomUUID(),
          },
          {
            maxAttempts: 5,
            initialDelayMs: 60000, // 1 minute initial delay
            metadata: {
              original_error: errorMessage,
              enqueued_at: new Date().toISOString(),
            }
          }
        );
        logStep("✅ Failed webhook enqueued for retry", { eventId, eventType });
      }

      // Update webhook event record as failed
      if (eventId) {
        await supabaseService
          .from("stripe_webhook_events")
          .update({
            success: false,
            error_message: errorMessage
          })
          .eq("stripe_event_id", eventId);
      }
    } catch (dlqError: any) {
      logger.error("Failed to enqueue webhook to DLQ", dlqError instanceof Error ? dlqError : new Error(String(dlqError)), {
        eventId,
        originalError: errorMessage
      });
    }

    // ⚠️ IMPORTANT: Return 200 OK even on error
    // This tells Stripe "we received it, don't retry"
    // We handle retries internally via the webhook_retry_queue
    return new Response(JSON.stringify({
      received: true,
      error: errorMessage,
      note: "Webhook queued for retry"
    }), {
      status: 200, // ✅ Changed from 500 to 200
      headers: { "Content-Type": "application/json" }
    });
  }
});

