import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role key for admin operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Starting impression analytics refresh...');

    // Call the refresh function
    const { error } = await supabaseClient.rpc('refresh_impression_rollups', {}, {
      schema: 'analytics'
    });
    
    if (error) {
      console.error('Analytics refresh error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to refresh impression analytics',
        details: error.message 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log('Impression analytics refresh completed successfully');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Impression analytics refreshed successfully',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Refresh impression analytics error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: (error as any)?.message || 'Unknown error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
