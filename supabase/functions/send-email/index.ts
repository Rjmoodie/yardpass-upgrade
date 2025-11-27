import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { enqueueWithDLQ } from "../_shared/queue-utils.ts";
import { createScopedLogger } from "../_shared/logger.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const logger = createScopedLogger('send-email');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  use_queue?: boolean; // If true, enqueue instead of sending immediately
  email_type?: string; // 'purchase_confirmation', 'invite', 'reminder', etc.
  metadata?: Record<string, unknown>;
}

/**
 * Send Email Edge Function with Queue Support
 * 
 * If `use_queue=true` is passed, emails are queued for retry.
 * Otherwise, sends immediately (for backwards compatibility).
 */
const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, from, replyTo, use_queue, email_type, metadata }: EmailRequest & {
      use_queue?: boolean;
      email_type?: string;
      metadata?: Record<string, unknown>;
    } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // If queue is enabled, add to queue instead of sending immediately
    if (use_queue) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
      const supabaseService = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      const { data: queueItem, error: queueError } = await supabaseService
        .from("email_queue")
        .insert({
          to_email: to,
          subject,
          html,
          from_email: from || "Liventix <noreply@liventix.tech>",
          reply_to: replyTo || "support@liventix.tech",
          email_type: email_type || 'generic',
          metadata: metadata || {},
          status: 'pending',
          next_retry_at: new Date().toISOString(), // Process immediately
        })
        .select('id')
        .single();

      if (queueError) {
        console.error("Error queuing email:", queueError);
        // Fall through to immediate send if queue fails
      } else {
        console.log("Email queued successfully:", queueItem.id);
        return new Response(
          JSON.stringify({ 
            queued: true, 
            queue_id: queueItem.id,
            message: "Email queued for sending"
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }
    }

    // Immediate send (with retry logic)
    const response = await fetchWithRetry(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from || "Liventix <noreply@liventix.tech>",
          to: [to],
          subject,
          html,
          reply_to: replyTo || "support@liventix.tech",
        }),
      },
      3, // 3 retry attempts
      10000 // 10 second timeout
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend API error: ${response.status} - ${errorText}`);
    }

    const emailResponse = await response.json();

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

/**
 * Fetch with retry and exponential backoff
 */
async function fetchWithRetry(
  url: string, 
  init: RequestInit, 
  attempts = 3, 
  timeoutMs = 10000
): Promise<Response> {
  let lastErr: unknown;
  
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      
      // Don't retry on 4xx errors (client errors)
      if (res.ok || res.status < 500) {
        return res;
      }
      
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
    }
    
    // Exponential backoff: 1s, 5s, 30s
    if (i < attempts - 1) {
      const delayMs = i === 0 ? 1000 : i === 1 ? 5000 : 30000;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  
  throw lastErr instanceof Error ? lastErr : new Error("fetchWithRetry failed");
}

serve(handler);