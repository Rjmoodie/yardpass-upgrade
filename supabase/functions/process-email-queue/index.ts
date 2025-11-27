/**
 * Process Email Queue
 * 
 * This function processes emails from the email_queue table.
 * Should be called via pg_cron every 1 minute.
 * 
 * Features:
 * - Batch processing (50 emails per run)
 * - Rate limiting (100 emails/minute global, 10/minute per recipient)
 * - Exponential backoff retry (1s, 5s, 30s, 5m, 30m)
 * - Dead letter queue after max attempts
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { markQueueItemProcessed, markQueueItemFailed } from "../_shared/queue-utils.ts";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { retryWithBackoff } from "../_shared/retry-utils.ts";
import { createScopedLogger } from "../_shared/logger.ts";

const logger = createScopedLogger('process-email-queue');

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limits
const GLOBAL_RATE_LIMIT = 100; // emails per minute
const PER_RECIPIENT_RATE_LIMIT = 10; // emails per minute per recipient
const RATE_LIMIT_WINDOW = 60; // seconds

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logger.info("Starting email queue processing");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get next batch of emails to process (max 50 at a time)
    const { data: emails, error: fetchError } = await supabaseService
      .rpc('get_email_queue_batch', { batch_size: 50 });

    if (fetchError) {
      logger.error("Failed to fetch email queue batch", fetchError);
      throw new Error(`Failed to fetch batch: ${fetchError.message}`);
    }

    if (!emails || emails.length === 0) {
      logger.info("No emails to process");
      return new Response(JSON.stringify({ 
        processed: 0,
        message: "No emails in queue"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logger.info(`Processing ${emails.length} email(s)`, {
      emailIds: emails.map((e: any) => e.id),
    });

    let processed = 0;
    let failed = 0;
    let rateLimited = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Check global rate limit
    const globalLimit = await checkRateLimit(
      supabaseService,
      'email:global',
      GLOBAL_RATE_LIMIT,
      RATE_LIMIT_WINDOW
    );

    if (!globalLimit.allowed) {
      logger.warn("Global rate limit exceeded, re-queuing emails", {
        resetAt: globalLimit.resetAt.toISOString(),
      });

      // Re-queue all emails with delay
      for (const email of emails) {
        await supabaseService
          .from('email_queue')
          .update({
            status: 'pending',
            next_retry_at: globalLimit.resetAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id);
      }

      return new Response(JSON.stringify({
        processed: 0,
        rateLimited: emails.length,
        message: `Global rate limit exceeded. Resetting at ${globalLimit.resetAt.toISOString()}`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const email of emails) {
      try {
        // Check per-recipient rate limit
        const recipientLimit = await checkRateLimit(
          supabaseService,
          `email:recipient:${email.to_email}`,
          PER_RECIPIENT_RATE_LIMIT,
          RATE_LIMIT_WINDOW
        );

        if (!recipientLimit.allowed) {
          logger.warn("Recipient rate limit exceeded, re-queuing", {
            emailId: email.id,
            recipient: email.to_email,
            resetAt: recipientLimit.resetAt.toISOString(),
          });

          await supabaseService
            .from('email_queue')
            .update({
              status: 'pending',
              next_retry_at: recipientLimit.resetAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', email.id);

          rateLimited++;
          continue;
        }

        // Send email with retry logic
        await retryWithBackoff(
          async () => {
            const response = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
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
          },
          {
            operationName: `send-email-${email.id}`,
            maxRetries: 3,
            backoffSchedule: [1000, 5000, 30000], // 1s, 5s, 30s
            retryable: (error: any) => {
              // Retry on 5xx errors and network errors
              if (error?.message?.includes('Resend API error: 5')) return true;
              if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNRESET') return true;
              return false;
            },
          }
        );

        // Mark as sent
        await markQueueItemProcessed(supabaseService, 'email_queue', email.id);
        processed++;

        logger.info("Email sent successfully", {
          emailId: email.id,
          to: email.to_email,
          emailType: email.email_type,
        });

      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Failed to send email", 
          error instanceof Error ? error : new Error(errorMessage),
          {
            emailId: email.id,
            to: email.to_email,
            emailType: email.email_type,
          }
        );

        await markQueueItemFailed(
          supabaseService,
          'email_queue',
          email.id,
          errorMessage
        );
        failed++;
        errors.push({ id: email.id, error: errorMessage });
      }
    }

    logger.info("Email queue processing complete", {
      processed,
      failed,
      rateLimited,
      total: emails.length,
    });

    return new Response(JSON.stringify({
      processed,
      failed,
      rateLimited,
      total: emails.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logger.error("Fatal error in email queue processor", 
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

