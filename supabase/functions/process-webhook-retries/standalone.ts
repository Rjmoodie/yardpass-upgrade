/**
 * Process Webhook Retry Queue - STANDALONE VERSION
 * 
 * This is a standalone version with all shared utilities inlined.
 * Use this for Dashboard deployment (which doesn't bundle _shared/).
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import Stripe from "https://esm.sh/stripe@14.21.0";

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

// Retry utilities
async function retryWithBackoff<T>(fn: () => Promise<T>, options: { operationName: string; maxRetries?: number; backoffSchedule?: number[]; retryable?: (error: any) => boolean }): Promise<T> {
  const { operationName, maxRetries = 3, backoffSchedule = [1000, 5000, 30000], retryable = (error: any) => {
    if (error?.status >= 500) return true;
    if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNRESET') return true;
    if (error?.type === 'network' || error?.type === 'timeout') return true;
    return false;
  } } = options;
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (!retryable(error) || attempt === maxRetries) throw error;
      const delay = backoffSchedule[Math.min(attempt, backoffSchedule.length - 1)] || 30000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// Queue utilities
async function markQueueItemProcessed(supabaseClient: any, queueTable: 'email_queue' | 'webhook_retry_queue', itemId: string): Promise<void> {
  const processedField = queueTable === 'email_queue' ? 'sent_at' : 'processed_at';
  const { error } = await supabaseClient.from(queueTable).update({ status: queueTable === 'email_queue' ? 'sent' : 'processed', [processedField]: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', itemId);
  if (error) throw new Error(`Failed to mark item as processed: ${error.message}`);
}

async function markQueueItemFailed(supabaseClient: any, queueTable: 'email_queue' | 'webhook_retry_queue', itemId: string, errorMessage: string): Promise<void> {
  const { data: current, error: fetchError } = await supabaseClient.from(queueTable).select('attempts, max_attempts').eq('id', itemId).single();
  if (fetchError) throw new Error(`Failed to fetch item: ${fetchError.message}`);
  const newAttempts = (current.attempts || 0) + 1;
  const maxAttempts = current.max_attempts || 5;
  const retryFunction = queueTable === 'email_queue' ? 'calculate_email_retry_time' : 'calculate_webhook_retry_time';
  if (newAttempts >= maxAttempts) {
    const { error } = await supabaseClient.from(queueTable).update({ status: 'dead_letter', last_error: errorMessage, error_count: newAttempts, failed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', itemId);
    if (error) throw new Error(`Failed to mark item as dead letter: ${error.message}`);
  } else {
    const { data: retryTime, error: retryError } = await supabaseClient.rpc(retryFunction, { attempt_number: newAttempts - 1 });
    if (retryError) throw new Error(`Failed to calculate retry time: ${retryError.message}`);
    const { error } = await supabaseClient.from(queueTable).update({ status: 'pending', attempts: newAttempts, error_count: newAttempts, last_error: errorMessage, next_retry_at: retryTime, updated_at: new Date().toISOString() }).eq('id', itemId);
    if (error) throw new Error(`Failed to schedule retry: ${error.message}`);
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

const logger = createScopedLogger('process-webhook-retries');
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    logger.info("Starting webhook retry queue processing");
    const supabaseService = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
    const { data: webhooks, error: fetchError } = await supabaseService.rpc('get_webhook_retry_batch', { batch_size: 10 });
    if (fetchError) {
      logger.error("Failed to fetch webhook retry batch", fetchError);
      throw new Error(`Failed to fetch batch: ${fetchError.message}`);
    }
    if (!webhooks || webhooks.length === 0) {
      logger.info("No webhooks to process");
      return new Response(JSON.stringify({ processed: 0, message: "No webhooks in queue" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    logger.info(`Processing ${webhooks.length} webhook(s)`, { webhookIds: webhooks.map((w: any) => w.id) });
    let processed = 0, failed = 0;
    const errors: Array<{ id: string; error: string }> = [];
    for (const webhook of webhooks) {
      try {
        if (webhook.webhook_type === 'stripe') {
          await processStripeWebhook(supabaseService, webhook);
          await markQueueItemProcessed(supabaseService, 'webhook_retry_queue', webhook.id);
          processed++;
          logger.info("Webhook processed successfully", { webhookId: webhook.id });
        } else {
          logger.warn("Unknown webhook type", { webhookId: webhook.id, webhookType: webhook.webhook_type });
          await markQueueItemFailed(supabaseService, 'webhook_retry_queue', webhook.id, `Unknown webhook type: ${webhook.webhook_type}`);
          failed++;
        }
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Failed to process webhook", error instanceof Error ? error : new Error(errorMessage), { webhookId: webhook.id, webhookType: webhook.webhook_type });
        await markQueueItemFailed(supabaseService, 'webhook_retry_queue', webhook.id, errorMessage);
        failed++;
        errors.push({ id: webhook.id, error: errorMessage });
      }
    }
    logger.info("Webhook retry processing complete", { processed, failed, total: webhooks.length });
    return new Response(JSON.stringify({ processed, failed, total: webhooks.length, errors: errors.length > 0 ? errors : undefined }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    logger.error("Fatal error in webhook retry processor", error instanceof Error ? error : new Error(String(error)));
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function processStripeWebhook(supabaseService: any, webhook: any): Promise<void> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) throw new Error("Missing Stripe credentials");
  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const payload = webhook.payload;
  const headers = webhook.headers || {};
  const signature = headers['stripe-signature'];
  if (signature && typeof payload === 'object') {
    try {
      const bodyString = JSON.stringify(payload);
      await stripe.webhooks.constructEventAsync(bodyString, signature, webhookSecret);
    } catch (sigError: any) {
      throw new Error(`Signature verification failed: ${sigError.message}`);
    }
  }
  const event = payload as any;
  if (!event.type || !event.id) throw new Error("Invalid webhook payload: missing type or id");
  logger.info("Processing Stripe webhook event", { eventId: event.id, eventType: event.type });
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
    if (!queryValue) throw new Error("Could not determine session ID to query order");
    const { data: order, error: orderError } = await supabaseService.from("orders").select("*").eq(queryField, queryValue).maybeSingle();
    if (orderError) throw new Error(`Database error: ${orderError.message}`);
    if (!order) throw new Error(`Order not found for ${queryField}: ${queryValue}`);
    if (order.status === 'paid') {
      logger.info("Order already processed, skipping", { orderId: order.id });
      return;
    }
    const { data: updateResult, error: updateError } = await supabaseService.from("orders").update({ status: 'paid', paid_at: new Date().toISOString() }).eq("id", order.id).eq("status", "pending").select("id").maybeSingle();
    if (updateError) throw new Error(`Failed to update order: ${updateError.message}`);
    if (!updateResult) {
      logger.info("Order already being processed, skipping", { orderId: order.id });
      return;
    }
    const sessionIdForProcessing = stripeSessionId || order.stripe_session_id;
    await retryWithBackoff(async () => {
      const processPaymentResponse = await supabaseService.functions.invoke('process-payment', { body: { sessionId: sessionIdForProcessing } });
      if (processPaymentResponse.error) throw new Error(`process-payment failed: ${processPaymentResponse.error.message || JSON.stringify(processPaymentResponse.error)}`);
      return processPaymentResponse;
    }, { operationName: 'process-payment-retry', maxRetries: 3, backoffSchedule: [1000, 5000, 30000] });
    logger.info("Payment processed successfully", { orderId: order.id });
  } else {
    logger.warn("Unhandled webhook event type in retry", { eventType: event.type, eventId: event.id });
  }
}

