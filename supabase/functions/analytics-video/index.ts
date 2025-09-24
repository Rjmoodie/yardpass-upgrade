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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get user from JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    
    if (path === 'event') {
      return await handleEventAnalytics(req, supabaseClient, user.id);
    } else if (path === 'content') {
      return await handleContentAnalytics(req, supabaseClient, user.id);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return new Response(JSON.stringify({ error: (error as any)?.message || 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function handleEventAnalytics(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get('event_id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (!eventId) {
    return new Response(JSON.stringify({ error: 'event_id required' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Check if user can manage this event
  const { data: canManage } = await supabase.rpc('is_event_manager', { p_event_id: eventId });
  if (!canManage) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 403,
    });
  }

  // Get aggregated counters
  const { data: counters, error: countersError } = await supabase
    .from('event_video_counters')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (countersError && countersError.code !== 'PGRST116') {
    console.error('Counters error:', countersError);
  }

  // Get time series data if date range provided
  let timeSeriesData = null;
  if (from && to) {
    const { data: timeSeries, error: timeSeriesError } = await supabase
      .from('event_video_kpis_daily')
      .select('*')
      .eq('event_id', eventId)
      .gte('d', from)
      .lte('d', to)
      .order('d');

    if (timeSeriesError) {
      console.error('Time series error:', timeSeriesError);
    } else {
      timeSeriesData = timeSeries;
    }
  }

  return new Response(JSON.stringify({
    counters: counters || {
      views_total: 0,
      views_unique: 0,
      completions: 0,
      avg_dwell_ms: 0,
      clicks_tickets: 0,
      clicks_details: 0,
      clicks_organizer: 0,
      clicks_share: 0,
      clicks_comment: 0,
      likes: 0,
      comments: 0,
      shares: 0
    },
    timeSeries: timeSeriesData || []
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleContentAnalytics(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get('event_id');
  const metric = url.searchParams.get('metric') || 'views';
  const limit = parseInt(url.searchParams.get('limit') || '10');

  if (!eventId) {
    return new Response(JSON.stringify({ error: 'event_id required' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Check if user can manage this event
  const { data: canManage } = await supabase.rpc('is_event_manager', { p_event_id: eventId });
  if (!canManage) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 403,
    });
  }

  // Get top posts with aggregated metrics
  let orderBy = 'post_views.dwell_ms';
  if (metric === 'ctr') orderBy = 'ticket_clicks';
  else if (metric === 'engagement') orderBy = 'total_engagement';

  const { data: topPosts, error } = await supabase.rpc('get_top_posts_analytics', {
    p_event_id: eventId,
    p_metric: metric,
    p_limit: limit
  });

  if (error) {
    console.error('Top posts error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch top posts' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  return new Response(JSON.stringify({ posts: topPosts || [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}