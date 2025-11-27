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
    // Create service role client for inserting analytics data (bypasses RLS)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // Create anon client for user authentication (if needed)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const { data: userData } = await supabaseClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      userId = userData?.user?.id ?? null;
    }

    const { type, data } = await req.json();

    // Handle multiple IPs in x-forwarded-for header (take the first one)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const rawIP = forwardedFor 
      ? forwardedFor.split(',')[0].trim() 
      : req.headers.get('x-real-ip');
    // Convert to INET-compatible format (null if invalid, otherwise pass as string)
    const clientIP = rawIP && rawIP !== 'unknown' ? rawIP : null;
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (type === 'view') {
      // Insert post view with enhanced video metrics
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
          user_agent: userAgent,
          // Enhanced video performance metrics
          video_load_time: data.video_load_time || null,
          video_start_time: data.video_start_time || null,
          video_buffer_events: data.video_buffer_events || 0,
          video_quality: data.video_quality || null,
          connection_type: data.connection_type || null,
          device_type: data.device_type || null,
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

    } else if (type === 'video_performance') {
      // Enhanced video performance tracking
      const { error } = await supabaseClient
        .from('video_performance_metrics')
        .insert({
          post_id: data.post_id,
          event_id: data.event_id,
          user_id: data.user_id || null,
          session_id: data.session_id,
          video_url: data.video_url,
          load_time_ms: data.load_time_ms,
          first_frame_time_ms: data.first_frame_time_ms,
          buffer_events: data.buffer_events || 0,
          quality_changes: data.quality_changes || 0,
          connection_speed: data.connection_speed,
          device_type: data.device_type,
          browser_type: data.browser_type,
          video_format: data.video_format,
          error_events: data.error_events || 0,
          ip_address: clientIP,
          user_agent: userAgent
        });

      if (error) {
        console.error('Error inserting video performance:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

    } else if (type === 'feed_performance') {
      // Track feed loading performance
      const { error } = await supabaseClient
        .from('feed_performance_metrics')
        .insert({
          user_id: data.user_id || null,
          session_id: data.session_id,
          feed_type: data.feed_type || 'home',
          load_time_ms: data.load_time_ms,
          query_time_ms: data.query_time_ms,
          item_count: data.item_count,
          cache_hit: data.cache_hit || false,
          connection_speed: data.connection_speed,
          device_type: data.device_type,
          ip_address: clientIP,
          user_agent: userAgent
        });

      if (error) {
        console.error('Error inserting feed performance:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

    } else if (type === 'video_error') {
      // Track video playback errors
      
      // Validate error_type (strict enum values)
      const validErrorTypes = [
        'load_error',
        'playback_error',
        'hls_fatal_error',
        'hls_network_error',
        'hls_media_error',
        'hls_init_error',
        'autoplay_blocked',
        'timeout',
        'unknown'
      ];
      
      const errorType = data.error_type || 'unknown';
      if (!validErrorTypes.includes(errorType)) {
        return new Response(
          JSON.stringify({ error: `Invalid error_type: ${errorType}` }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      const { data: insertData, error } = await supabaseService
        .rpc('insert_video_error', {
          p_error_type: errorType,
          p_playback_id: data.playback_id || null,
          p_url: data.url || null,
          p_error_message: (data.error_message || 'Unknown error').substring(0, 1000),
          p_post_id: data.context?.postId || null,
          p_event_id: data.context?.eventId || null,
          p_user_id: userId || data.context?.user_id || null,
          p_session_id: data.context?.session_id || null,
          p_context: {
            user_agent: data.context?.userAgent || userAgent,
            network_type: data.context?.networkType || null,
            ready_state: data.context?.readyState || null,
            network_state: data.context?.networkState || null,
            hls_error_type: data.context?.hlsErrorType || null,
            hls_error_details: data.context?.hlsErrorDetails || null,
          },
          p_ip_address: clientIP,
          p_user_agent: userAgent,
        });

      if (error) {
        console.error('Error inserting video error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

    } else if (type === 'video_metric') {
      // Track video performance metrics
      
      // Validate metric type (strict enum values)
      const validMetrics = [
        'time_to_first_frame',
        'time_to_play',
        'buffering_duration',
        'playback_start_failed'
      ];
      
      const metric = data.metric;
      if (!metric || !validMetrics.includes(metric)) {
        console.warn('Invalid or missing video metric:', metric);
        return new Response(
          JSON.stringify({ error: `Invalid metric: ${metric || 'missing'}` }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Validate and clamp value (milliseconds, reasonable bounds)
      // Handle both number and string inputs, round to integer
      let value: number;
      if (typeof data.value === 'number') {
        value = Math.round(data.value); // Round to nearest integer
      } else if (typeof data.value === 'string') {
        const parsed = parseFloat(data.value);
        value = isNaN(parsed) ? 0 : Math.round(parsed);
      } else {
        console.warn('Invalid video metric value type:', typeof data.value, data.value);
        value = 0;
      }
      
      if (isNaN(value) || value < 0) {
        value = 0;
      }
      // Cap at 5 minutes (300000ms) - anything larger is likely bad data
      if (value > 300000) {
        value = 300000;
      }
      
      const { data: insertData, error } = await supabaseService
        .rpc('insert_video_metric', {
          p_metric: metric,
          p_playback_id: data.playback_id || null,
          p_url: data.url || null,
          p_value: value,
          p_post_id: data.context?.postId || null,
          p_event_id: data.context?.eventId || null,
          p_user_id: userId || data.context?.user_id || null,
          p_session_id: data.context?.session_id || null,
          p_context: {
            user_agent: data.context?.userAgent || userAgent,
            network_type: data.context?.networkType || null,
            device_type: data.context?.device_type || null,
          },
          p_ip_address: clientIP,
          p_user_agent: userAgent,
        });

      if (error) {
        console.error('Error inserting video metric:', error);
        console.error('Metric data:', { metric, value, playback_id: data.playback_id });
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
      JSON.stringify({ error: (error as any).message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});