import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  console.log(`[${correlationId}] Starting cleanup job`);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { keep_request_logs_days = 14, keep_dlq_days = 30 } = await req.json().catch(() => ({}));

    // Cleanup old request logs (default 14 days)
    console.log(`[${correlationId}] Cleaning request logs older than ${keep_request_logs_days} days`);
    await supabase.rpc('prune_request_logs', { p_keep_days: keep_request_logs_days });

    // Cleanup successful DLQ entries (default 30 days)
    console.log(`[${correlationId}] Cleaning successful DLQ entries older than ${keep_dlq_days} days`);
    await supabase.rpc('prune_dead_letters', { p_keep_days: keep_dlq_days });

    // Get some stats
    const { data: requestLogCount } = await supabase
      .from('request_logs')
      .select('id', { count: 'exact', head: true });

    const { data: dlqCount } = await supabase
      .from('dead_letter_webhooks')
      .select('id', { count: 'exact', head: true });

    const { data: circuitBreakerStates } = await supabase
      .from('circuit_breaker_state')
      .select('id, state, failure_count, last_failure_at');

    console.log(`[${correlationId}] Cleanup complete`);

    return new Response(JSON.stringify({
      success: true,
      correlation_id: correlationId,
      stats: {
        remaining_request_logs: requestLogCount?.length || 0,
        remaining_dlq_entries: dlqCount?.length || 0,
        circuit_breaker_states: circuitBreakerStates || []
      },
      cleaned: {
        request_logs_days: keep_request_logs_days,
        dlq_days: keep_dlq_days
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[${correlationId}] Cleanup job failed:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      correlation_id: correlationId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});