import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ReplayableWebhook {
  id: string;
  correlation_id: string;
  webhook_type: string;
  payload: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { webhook_type, batch_size = 10 } = await req.json();
  const processed = [];
  const failed = [];

  console.log(`Starting DLQ replay for webhook_type: ${webhook_type || 'all'}, batch_size: ${batch_size}`);

  try {
    for (let i = 0; i < batch_size; i++) {
      // Pop next webhook from DLQ
      const { data: webhooks, error: popError } = await supabase.rpc('dlq_pop_next', {
        p_webhook_type: webhook_type
      });

      if (popError) {
        console.error('Failed to pop webhook from DLQ:', popError);
        break;
      }

      if (!webhooks || webhooks.length === 0) {
        console.log('No more webhooks in DLQ');
        break;
      }

      const webhook = webhooks[0] as ReplayableWebhook;
      console.log(`Replaying webhook ${webhook.id} (${webhook.webhook_type})`);

      try {
        // Replay the webhook by calling the appropriate edge function
        const replayResult = await replayWebhook(webhook);
        
        if (replayResult.success) {
          // Mark as succeeded
          await supabase.rpc('dlq_set_status', {
            p_id: webhook.id,
            p_status: 'succeeded'
          });
          
          processed.push({
            id: webhook.id,
            correlation_id: webhook.correlation_id,
            type: webhook.webhook_type,
            status: 'succeeded'
          });
          
          console.log(`Successfully replayed webhook ${webhook.id}`);
        } else {
          throw new Error(replayResult.error || 'Replay failed');
        }
        
      } catch (replayError) {
        console.error(`Failed to replay webhook ${webhook.id}:`, replayError);
        
        // Mark as failed
        await supabase.rpc('dlq_set_status', {
          p_id: webhook.id,
          p_status: 'failed',
          p_failure_reason: replayError.message
        });
        
        failed.push({
          id: webhook.id,
          correlation_id: webhook.correlation_id,
          type: webhook.webhook_type,
          error: replayError.message
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: processed.length,
      failed: failed.length,
      details: { processed, failed }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('DLQ replay worker failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      processed: processed.length,
      failed: failed.length
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function replayWebhook(webhook: ReplayableWebhook): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const functionUrl = `${supabaseUrl}/functions/v1/stripe-webhook`;
    
    // Create a mock Stripe webhook request
    const mockHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'DLQ-Replay-Worker',
      'X-Correlation-ID': webhook.correlation_id,
      'X-Replay-Source': 'dlq'
    };

    // Note: For production, you'd need to properly sign the webhook
    // This is a simplified replay that bypasses signature verification
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: mockHeaders,
      body: JSON.stringify({
        type: webhook.webhook_type,
        data: webhook.payload.data,
        id: webhook.payload.id || `dlq_replay_${webhook.id}`,
        created: Math.floor(Date.now() / 1000),
        livemode: webhook.payload.livemode || false,
        api_version: webhook.payload.api_version || '2023-10-16',
        object: 'event',
        replay_source: 'dlq'
      })
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true };
    } else {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

  } catch (error) {
    return { success: false, error: error.message };
  }
}