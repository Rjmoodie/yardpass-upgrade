// Supabase Edge Function: refresh-analytics
// Purpose: Refresh analytics materialized views via cron job
// Trigger: Every 5 minutes via Supabase Cron

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Verify cron secret (optional security layer)
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const startTime = Date.now();

  try {
    // Create admin client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Call refresh function
    const { data, error } = await supabase.rpc('refresh_analytics');

    if (error) {
      console.error('[ANALYTICS] Refresh failed:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          duration_ms: Date.now() - startTime
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[ANALYTICS] ✅ Refresh completed in ${duration}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        duration_ms: duration,
        refreshed_at: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );

  } catch (err) {
    console.error('[ANALYTICS] Unexpected error:', err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: String(err),
        duration_ms: Date.now() - startTime
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
