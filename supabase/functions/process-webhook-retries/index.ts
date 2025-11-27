/**
 * Process Webhook Retry Queue
 * 
 * This function processes failed webhooks from the retry queue.
 * Should be called via pg_cron every 5 minutes.
 * 
 * Processes webhooks with exponential backoff:
 * - Attempt 1: 1 minute delay
 * - Attempt 2: 5 minutes delay
 * - Attempt 3: 30 minutes delay
 * - Attempt 4: 2 hours delay
 * - Attempt 5: 24 hours delay
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { markQueueItemProcessed, markQueueItemFailed } from "../_shared/queue-utils.ts";
import { createScopedLogger } from "../_shared/logger.ts";
import { retryWithBackoff } from "../_shared/retry-utils.ts";

const logger = createScopedLogger('process-webhook-retries');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info("Starting webhook retry queue processing");

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get next batch of webhooks to retry (max 10 at a time)
    const { data: webhooks, error: fetchError } = await supabaseService
      .rpc('get_webhook_retry_batch', { batch_size: 10 });

    if (fetchError) {
      logger.error("Failed to fetch webhook retry batch", fetchError);
      throw new Error(`Failed to fetch batch: ${fetchError.message}`);
    }

    if (!webhooks || webhooks.length === 0) {
      logger.info("No webhooks to process");
      return new Response(JSON.stringify({ 
        processed: 0,
        message: "No webhooks in queue"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logger.info(`Processing ${webhooks.length} webhook(s)`, {
      webhookIds: webhooks.map((w: any) => w.id),
    });

    let processed = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const webhook of webhooks) {
      try {
        if (webhook.webhook_type === 'stripe') {
          await processStripeWebhook(supabaseService, webhook);
          await markQueueItemProcessed(supabaseService, 'webhook_retry_queue', webhook.id);
          processed++;
          logger.info("Webhook processed successfully", { webhookId: webhook.id });
        } else {
          logger.warn("Unknown webhook type", { 
            webhookId: webhook.id, 
            webhookType: webhook.webhook_type 
          });
          await markQueueItemFailed(
            supabaseService,
            'webhook_retry_queue',
            webhook.id,
            `Unknown webhook type: ${webhook.webhook_type}`
          );
          failed++;
        }
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Failed to process webhook", error instanceof Error ? error : new Error(errorMessage), {
          webhookId: webhook.id,
          webhookType: webhook.webhook_type,
        });

        await markQueueItemFailed(
          supabaseService,
          'webhook_retry_queue',
          webhook.id,
          errorMessage
        );
        failed++;
        errors.push({ id: webhook.id, error: errorMessage });
      }
    }

    logger.info("Webhook retry processing complete", {
      processed,
      failed,
      total: webhooks.length,
    });

    return new Response(JSON.stringify({
      processed,
      failed,
      total: webhooks.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logger.error("Fatal error in webhook retry processor", 
      error instanceof Error ? error : new Error(String(error))
    );

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Process a Stripe webhook from the retry queue
 */
async function processStripeWebhook(
  supabaseService: any,
  webhook: any
): Promise<void> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!stripeKey || !webhookSecret) {
    throw new Error("Missing Stripe credentials");
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

  // Verify webhook signature if we have it
  const payload = webhook.payload;
  const headers = webhook.headers || {};
  const signature = headers['stripe-signature'];

  if (signature && typeof payload === 'object') {
    // Re-verify signature for security
    try {
      // Reconstruct the event to verify signature
      const bodyString = JSON.stringify(payload);
      await stripe.webhooks.constructEventAsync(bodyString, signature, webhookSecret);
    } catch (sigError: any) {
      throw new Error(`Signature verification failed: ${sigError.message}`);
    }
  }

  // Process the webhook by calling the internal webhook processing logic
  // We'll invoke the stripe-webhook function's logic, but we can also do it directly here
  
  const event = payload as any;
  
  if (!event.type || !event.id) {
    throw new Error("Invalid webhook payload: missing type or id");
  }

  logger.info("Processing Stripe webhook event", {
    eventId: event.id,
    eventType: event.type,
  });

  // Handle checkout.session.completed or payment_intent.succeeded
  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    let stripeSessionId: string | null = null;
    let checkoutSessionId: string | null = null;
    let queryField: string = "stripe_session_id";
    let queryValue: string | null = null;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      stripeSessionId = session.id;
      queryField = "stripe_session_id";
      queryValue = stripeSessionId;
    } else if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      checkoutSessionId = paymentIntent.metadata?.checkout_session_id || null;
      
      if (checkoutSessionId) {
        queryField = "checkout_session_id";
        queryValue = checkoutSessionId;
      } else {
        throw new Error("No checkout_session_id in payment_intent metadata");
      }
    }

    if (!queryValue) {
      throw new Error("Could not determine session ID to query order");
    }

    // Find the order
    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .select("*")
      .eq(queryField, queryValue)
      .maybeSingle();

    if (orderError) {
      throw new Error(`Database error: ${orderError.message}`);
    }

    if (!order) {
      throw new Error(`Order not found for ${queryField}: ${queryValue}`);
    }

    // If already processed, skip
    if (order.status === 'paid') {
      logger.info("Order already processed, skipping", { orderId: order.id });
      return;
    }

    // Atomically update order status
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
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    if (!updateResult) {
      logger.info("Order already being processed, skipping", { orderId: order.id });
      return;
    }

    // Call process-payment to handle ticket creation and email sending
    const sessionIdForProcessing = stripeSessionId || order.stripe_session_id;
    
    await retryWithBackoff(
      async () => {
        const processPaymentResponse = await supabaseService.functions.invoke('process-payment', {
          body: { sessionId: sessionIdForProcessing }
        });

        if (processPaymentResponse.error) {
          throw new Error(`process-payment failed: ${processPaymentResponse.error.message || JSON.stringify(processPaymentResponse.error)}`);
        }

        return processPaymentResponse;
      },
      {
        operationName: 'process-payment-retry',
        maxRetries: 3,
        backoffSchedule: [1000, 5000, 30000],
      }
    );

    logger.info("Payment processed successfully", { orderId: order.id });
  } else {
    logger.warn("Unhandled webhook event type in retry", { 
      eventType: event.type,
      eventId: event.id,
    });
    // For other event types, we'll mark as processed but log a warning
    // In a production system, you'd want to handle all event types
  }
}

