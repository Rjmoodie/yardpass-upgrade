/**
 * Process Email Queue - STANDALONE VERSION
 * 
 * This is a standalone version with all shared utilities inlined.
 * Use this for Dashboard deployment (which doesn't bundle _shared/).
 * 
 * This function processes emails from the email_queue table.
 * Should be called via pg_cron every 1 minute.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ============================================================================
// INLINED SHARED UTILITIES
// ============================================================================

// Logger
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function logWithContext(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context: { feature: string; requestId?: string; userId?: string; operation?: string; metadata?: Record<string, unknown> }
): void {
  const logEntry = {
    level,
    message,
    feature: context.feature,
    requestId: context.requestId || generateRequestId(),
    userId: context.userId,
    operation: context.operation,
    timestamp: new Date().toISOString(),
    ...context.metadata,
  };
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
    info: (message: string, metadata?: Record<string, unknown>) => {
      logWithContext('info', message, { feature, metadata });
    },
    warn: (message: string, metadata?: Record<string, unknown>) => {
      logWithContext('warn', message, { feature, metadata });
    },
    error: (message: string, error?: Error, metadata?: Record<string, unknown>) => {
      logWithContext('error', message, {
        feature,
        metadata: { ...metadata, error: error?.message, stack: error?.stack },
      });
    },
    debug: (message: string, metadata?: Record<string, unknown>) => {
      logWithContext('debug', message, { feature, metadata });
    },
  };
}

// Retry utilities
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { operationName: string; maxRetries?: number; backoffSchedule?: number[]; retryable?: (error: any) => boolean }
): Promise<T> {
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

// Rate limiter
async function checkRateLimit(
  supabaseClient: any,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: Date; limit: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);
  const { data: counter, error: fetchError } = await supabaseClient
    .from('rate_limit_counters')
    .select('*')
    .eq('key', key)
    .maybeSingle();
  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Rate limit check failed: ${fetchError.message}`);
  }
  if (!counter || new Date(counter.window_start) < windowStart) {
    const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
    const { data: newCounter, error: insertError } = await supabaseClient
      .from('rate_limit_counters')
      .upsert({ key, count: 1, window_start: now.toISOString(), window_end: windowEnd.toISOString(), updated_at: now.toISOString() }, { onConflict: 'key' })
      .select()
      .single();
    if (insertError) throw new Error(`Rate limit initialization failed: ${insertError.message}`);
    return { allowed: true, remaining: limit - 1, resetAt: new Date(newCounter.window_end), limit };
  }
  const { data: updated, error: updateError } = await supabaseClient
    .rpc('increment_rate_limit', { p_key: key, p_increment: 1, p_limit: limit })
    .single();
  if (updateError) {
    if (updateError.code === '42883') {
      const { data: manualUpdate } = await supabaseClient
        .from('rate_limit_counters')
        .update({ count: counter.count + 1, updated_at: now.toISOString() })
        .eq('key', key)
        .eq('count', counter.count)
        .select('count')
        .single();
      if (manualUpdate) {
        return { allowed: manualUpdate.count <= limit, remaining: Math.max(0, limit - manualUpdate.count), resetAt: new Date(counter.window_end), limit };
      }
    }
    throw new Error(`Rate limit increment failed: ${updateError.message}`);
  }
  const count = updated?.count || counter.count + 1;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt: new Date(counter.window_end), limit };
}

// Queue utilities
async function markQueueItemProcessed(supabaseClient: any, queueTable: 'email_queue' | 'webhook_retry_queue', itemId: string): Promise<void> {
  const processedField = queueTable === 'email_queue' ? 'sent_at' : 'processed_at';
  const { error } = await supabaseClient
    .from(queueTable)
    .update({ status: queueTable === 'email_queue' ? 'sent' : 'processed', [processedField]: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw new Error(`Failed to mark item as processed: ${error.message}`);
}

async function markQueueItemFailed(supabaseClient: any, queueTable: 'email_queue' | 'webhook_retry_queue', itemId: string, errorMessage: string): Promise<void> {
  const { data: current, error: fetchError } = await supabaseClient
    .from(queueTable)
    .select('attempts, max_attempts')
    .eq('id', itemId)
    .single();
  if (fetchError) throw new Error(`Failed to fetch item: ${fetchError.message}`);
  const newAttempts = (current.attempts || 0) + 1;
  const maxAttempts = current.max_attempts || 5;
  const retryFunction = queueTable === 'email_queue' ? 'calculate_email_retry_time' : 'calculate_webhook_retry_time';
  if (newAttempts >= maxAttempts) {
    const { error } = await supabaseClient
      .from(queueTable)
      .update({ status: 'dead_letter', last_error: errorMessage, error_count: newAttempts, failed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', itemId);
    if (error) throw new Error(`Failed to mark item as dead letter: ${error.message}`);
  } else {
    const { data: retryTime, error: retryError } = await supabaseClient.rpc(retryFunction, { attempt_number: newAttempts - 1 });
    if (retryError) throw new Error(`Failed to calculate retry time: ${retryError.message}`);
    const { error } = await supabaseClient
      .from(queueTable)
      .update({ status: 'pending', attempts: newAttempts, error_count: newAttempts, last_error: errorMessage, next_retry_at: retryTime, updated_at: new Date().toISOString() })
      .eq('id', itemId);
    if (error) throw new Error(`Failed to schedule retry: ${error.message}`);
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

const logger = createScopedLogger('process-email-queue');
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GLOBAL_RATE_LIMIT = 100;
const PER_RECIPIENT_RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info("Starting email queue processing");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const { data: emails, error: fetchError } = await supabaseService.rpc('get_email_queue_batch', { batch_size: 50 });
    if (fetchError) {
      logger.error("Failed to fetch email queue batch", fetchError);
      throw new Error(`Failed to fetch batch: ${fetchError.message}`);
    }
    if (!emails || emails.length === 0) {
      logger.info("No emails to process");
      return new Response(JSON.stringify({ processed: 0, message: "No emails in queue" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logger.info(`Processing ${emails.length} email(s)`, { emailIds: emails.map((e: any) => e.id) });
    let processed = 0, failed = 0, rateLimited = 0;
    const errors: Array<{ id: string; error: string }> = [];
    const globalLimit = await checkRateLimit(supabaseService, 'email:global', GLOBAL_RATE_LIMIT, RATE_LIMIT_WINDOW);
    if (!globalLimit.allowed) {
      logger.warn("Global rate limit exceeded, re-queuing emails", { resetAt: globalLimit.resetAt.toISOString() });
      for (const email of emails) {
        await supabaseService.from('email_queue').update({ status: 'pending', next_retry_at: globalLimit.resetAt.toISOString(), updated_at: new Date().toISOString() }).eq('id', email.id);
      }
      return new Response(JSON.stringify({ processed: 0, rateLimited: emails.length, message: `Global rate limit exceeded. Resetting at ${globalLimit.resetAt.toISOString()}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const email of emails) {
      try {
        const recipientLimit = await checkRateLimit(supabaseService, `email:recipient:${email.to_email}`, PER_RECIPIENT_RATE_LIMIT, RATE_LIMIT_WINDOW);
        if (!recipientLimit.allowed) {
          logger.warn("Recipient rate limit exceeded, re-queuing", { emailId: email.id, recipient: email.to_email, resetAt: recipientLimit.resetAt.toISOString() });
          await supabaseService.from('email_queue').update({ status: 'pending', next_retry_at: recipientLimit.resetAt.toISOString(), updated_at: new Date().toISOString() }).eq('id', email.id);
          rateLimited++;
          continue;
        }
        await retryWithBackoff(async () => {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: email.from_email || "Liventix <noreply@liventix.tech>",
              to: [email.to_email],
              subject: email.subject,
              html: email.html,
              reply_to: email.reply_to || "support@liventix.tech",
            }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Resend API error: ${response.status} - ${errorText}`);
          }
          return await response.json();
        }, { operationName: `send-email-${email.id}`, maxRetries: 3, backoffSchedule: [1000, 5000, 30000], retryable: (error: any) => {
          if (error?.message?.includes('Resend API error: 5')) return true;
          if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNRESET') return true;
          return false;
        } });
        await markQueueItemProcessed(supabaseService, 'email_queue', email.id);
        processed++;
        logger.info("Email sent successfully", { emailId: email.id, to: email.to_email, emailType: email.email_type });
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Failed to send email", error instanceof Error ? error : new Error(errorMessage), { emailId: email.id, to: email.to_email, emailType: email.email_type });
        await markQueueItemFailed(supabaseService, 'email_queue', email.id, errorMessage);
        failed++;
        errors.push({ id: email.id, error: errorMessage });
      }
    }
    logger.info("Email queue processing complete", { processed, failed, rateLimited, total: emails.length });
    return new Response(JSON.stringify({ processed, failed, rateLimited, total: emails.length, errors: errors.length > 0 ? errors : undefined }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logger.error("Fatal error in email queue processor", error instanceof Error ? error : new Error(String(error)));
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

