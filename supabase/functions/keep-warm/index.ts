import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Warm up the public home feed RPC
    const { data, error } = await supabase.rpc('get_home_feed', {
      p_user_id: null,
      p_limit: 5,
      p_offset: 0,
    });

    if (error) {
      console.error('Error warming home feed:', error);
    } else {
      console.log('Successfully warmed home feed, got', data?.length || 0, 'events');
    }

    // Warm Mux poster endpoint
    try {
      await fetch('https://image.mux.com/placeholder/thumbnail.jpg', { method: 'HEAD' });
      console.log('Successfully warmed Mux image endpoint');
    } catch (e) {
      console.log('Failed to warm Mux image endpoint:', e);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        timestamp: new Date().toISOString(),
        warmed: ['home_feed', 'mux_image']
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error in keep-warm function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});