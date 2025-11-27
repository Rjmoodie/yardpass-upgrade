/**
 * Send Email - STANDALONE VERSION
 * 
 * This is a standalone version with all shared utilities inlined.
 * Use this for Dashboard deployment (which doesn't bundle _shared/).
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

// ============================================================================
// MAIN FUNCTION
// ============================================================================

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const logger = createScopedLogger('send-email');
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  use_queue?: boolean;
  email_type?: string;
  metadata?: Record<string, unknown>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { to, subject, html, from, replyTo, use_queue, email_type, metadata }: EmailRequest = await req.json();
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (use_queue) {
      const supabaseService = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
      const { data: queueItem, error: queueError } = await supabaseService.from("email_queue").insert({
        to_email: to, subject, html,
        from_email: from || "Liventix <noreply@liventix.tech>",
        reply_to: replyTo || "support@liventix.tech",
        email_type: email_type || 'generic',
        metadata: metadata || {},
        status: 'pending',
        next_retry_at: new Date().toISOString(),
      }).select('id').single();
      if (queueError) {
        console.error("Error queuing email:", queueError);
      } else {
        console.log("Email queued successfully:", queueItem.id);
        return new Response(JSON.stringify({ queued: true, queue_id: queueItem.id, message: "Email queued for sending" }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }
    const response = await fetchWithRetry('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: from || "Liventix <noreply@liventix.tech>",
        to: [to],
        subject,
        html,
        reply_to: replyTo || "support@liventix.tech",
      }),
    }, 3, 10000);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Resend API error: ${response.status} - ${errorText}`);
    }
    const emailResponse = await response.json();
    console.log("Email sent successfully:", emailResponse);
    return new Response(JSON.stringify(emailResponse), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3, timeoutMs = 10000): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok || res.status < 500) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
    }
    if (i < attempts - 1) {
      const delayMs = i === 0 ? 1000 : i === 1 ? 5000 : 30000;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetchWithRetry failed");
}

serve(handler);

