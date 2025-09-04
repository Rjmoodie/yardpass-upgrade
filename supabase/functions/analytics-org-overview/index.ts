import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const url = new URL(req.url);
    const orgId = url.searchParams.get('org_id');
    const fromDate = url.searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = url.searchParams.get('to') || new Date().toISOString();

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'org_id required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Check if user has access to this org
    const { data: membership } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Get org events for filtering
    const { data: events } = await supabase
      .from('events')
      .select('id')
      .eq('owner_context_type', 'organization')
      .eq('owner_context_id', orgId);

    const eventIds = events?.map(e => e.id) || [];

    if (eventIds.length === 0) {
      return new Response(JSON.stringify({
        kpis: {
          gross_revenue: 0,
          net_revenue: 0,
          platform_fees: 0,
          tickets_sold: 0,
          refund_rate: 0,
          no_show_rate: 0,
          unique_buyers: 0,
          repeat_buyers: 0,
          posts_created: 0,
          feed_engagements: 0
        },
        revenue_trend: [],
        top_events: [],
        events_leaderboard: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get KPIs using database function
    const { data: kpisData } = await supabase.rpc('get_event_kpis_daily', {
      p_event_ids: eventIds,
      p_from_date: fromDate.split('T')[0],
      p_to_date: toDate.split('T')[0]
    });

    // Calculate aggregated KPIs
    const totalRevenue = kpisData?.reduce((sum, row) => sum + row.gmv_cents, 0) || 0;
    const totalFees = kpisData?.reduce((sum, row) => sum + row.fees_cents, 0) || 0;
    const totalTickets = kpisData?.reduce((sum, row) => sum + row.units, 0) || 0;

    // Get refund data
    const { data: refundsData } = await supabase
      .from('refunds')
      .select('amount_cents, orders!inner(event_id)')
      .in('orders.event_id', eventIds)
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    const totalRefunds = refundsData?.reduce((sum, refund) => sum + refund.amount_cents, 0) || 0;
    const refundRate = totalRevenue > 0 ? (totalRefunds / totalRevenue) * 100 : 0;

    // Get scan data for no-show rate
    const { data: scanData } = await supabase.rpc('get_event_scans_daily', {
      p_event_ids: eventIds,
      p_from_date: fromDate.split('T')[0],
      p_to_date: toDate.split('T')[0]
    });

    const totalScans = scanData?.reduce((sum, row) => sum + row.scans, 0) || 0;
    const noShowRate = totalTickets > 0 ? ((totalTickets - totalScans) / totalTickets) * 100 : 0;

    // Get unique buyers
    const { data: buyersData } = await supabase
      .from('orders')
      .select('user_id')
      .in('event_id', eventIds)
      .eq('status', 'paid')
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    const uniqueBuyerIds = new Set(buyersData?.map(o => o.user_id) || []);
    const uniqueBuyers = uniqueBuyerIds.size;

    // Get posts and engagement data
    const { data: postsData } = await supabase
      .from('event_posts')
      .select('id')
      .in('event_id', eventIds)
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    const { data: engagementData } = await supabase.rpc('get_post_engagement_daily', {
      p_event_ids: eventIds,
      p_from_date: fromDate.split('T')[0],
      p_to_date: toDate.split('T')[0]
    });

    const totalEngagements = engagementData?.reduce((sum, row) => 
      sum + row.likes + row.comments + row.shares, 0) || 0;

    // Revenue trend data (daily)
    const revenueTrend = kpisData?.map(row => ({
      date: row.d,
      revenue: row.gmv_cents,
      event_id: row.event_id
    })) || [];

    // Top events by revenue
    const eventRevenue = new Map();
    kpisData?.forEach(row => {
      const current = eventRevenue.get(row.event_id) || 0;
      eventRevenue.set(row.event_id, current + row.gmv_cents);
    });

    const { data: eventDetails } = await supabase
      .from('events')
      .select('id, title')
      .in('id', eventIds);

    const topEvents = Array.from(eventRevenue.entries())
      .map(([eventId, revenue]) => ({
        event_id: eventId,
        title: eventDetails?.find(e => e.id === eventId)?.title || 'Unknown',
        revenue: revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const response = {
      kpis: {
        gross_revenue: totalRevenue,
        net_revenue: totalRevenue - totalFees,
        platform_fees: totalFees,
        tickets_sold: totalTickets,
        refund_rate: Math.round(refundRate * 100) / 100,
        no_show_rate: Math.round(noShowRate * 100) / 100,
        unique_buyers: uniqueBuyers,
        repeat_buyers: 0, // TODO: Calculate repeat buyers
        posts_created: postsData?.length || 0,
        feed_engagements: totalEngagements
      },
      revenue_trend: revenueTrend,
      top_events: topEvents,
      events_leaderboard: topEvents
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});