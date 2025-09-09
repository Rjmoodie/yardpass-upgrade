import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    }

    const { type, data } = await req.json();

    // Handle multiple IPs in x-forwarded-for header (take the first one)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIP = forwardedFor 
      ? forwardedFor.split(',')[0].trim() 
      : req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (type === 'view') {
      // Insert post view
      const { error } = await supabaseClient
        .from('post_views')
        .insert({
          post_id: data.post_id,
          event_id: data.event_id,
          user_id: data.user_id || null,
          session_id: data.session_id,
          qualified: data.qualified || false,
          completed: data.completed || false,
          dwell_ms: data.dwell_ms || 0,
          watch_percentage: data.watch_percentage || 0,
          source: data.source,
          ip_address: clientIP,
          user_agent: userAgent
        });

      if (error) {
        console.error('Error inserting post view:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

    } else if (type === 'click') {
      // Insert post click
      const { error } = await supabaseClient
        .from('post_clicks')
        .insert({
          post_id: data.post_id,
          event_id: data.event_id,
          user_id: data.user_id || null,
          session_id: data.session_id,
          target: data.target,
          source: data.source,
          ip_address: clientIP,
          user_agent: userAgent
        });

      if (error) {
        console.error('Error inserting post click:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid tracking type' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Analytics tracking error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});