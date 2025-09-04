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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Get parameters from request body for POST requests
    const { org_id: orgId, from: fromDate, to: toDate } = await req.json();

    // Set default date range if not provided
    const defaultFromDate = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const defaultToDate = toDate || new Date().toISOString();

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'org_id required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Check if user has access to this org
    const { data: membership, error: membershipError } = await supabase
      .from('org_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('Checking membership for org:', orgId, 'user:', user.id);
    console.log('Membership result:', membership, 'Error:', membershipError);

    if (!membership) {
      console.log('No membership found, checking if user is organization creator');
      // Also check if user is the organization creator
      const { data: org } = await supabase
        .from('organizations')
        .select('created_by')
        .eq('id', orgId)
        .single();
      
      if (org?.created_by !== user.id) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }
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
      p_from_date: defaultFromDate.split('T')[0],
      p_to_date: defaultToDate.split('T')[0]
    });

    // Calculate aggregated KPIs
    const totalRevenue = kpisData?.reduce((sum, row) => sum + row.gmv_cents, 0) || 0;
    const totalFees = kpisData?.reduce((sum, row) => sum + row.fees_cents, 0) || 0;
    const totalTickets = kpisData?.reduce((sum, row) => sum + row.units, 0) || 0;

    // Get refund data
    const { data: refundsData } = await supabase
      .from('refunds')
      .select('amount_cents, orders!fk_orders_event_id!inner(event_id)')
      .in('orders.event_id', eventIds)
      .gte('created_at', defaultFromDate)
      .lte('created_at', defaultToDate);

    const totalRefunds = refundsData?.reduce((sum, refund) => sum + refund.amount_cents, 0) || 0;
    const refundRate = totalRevenue > 0 ? (totalRefunds / totalRevenue) * 100 : 0;

    // Get scan data for no-show rate
    const { data: scanData } = await supabase.rpc('get_event_scans_daily', {
      p_event_ids: eventIds,
      p_from_date: defaultFromDate.split('T')[0],
      p_to_date: defaultToDate.split('T')[0]
    });

    const totalScans = scanData?.reduce((sum, row) => sum + row.scans, 0) || 0;
    const noShowRate = totalTickets > 0 ? ((totalTickets - totalScans) / totalTickets) * 100 : 0;

    // Get unique buyers
    const { data: buyersData } = await supabase
      .from('orders')
      .select('user_id')
      .in('event_id', eventIds)
      .eq('status', 'paid')
      .gte('created_at', defaultFromDate)
      .lte('created_at', defaultToDate);

    const uniqueBuyerIds = new Set(buyersData?.map(o => o.user_id) || []);
    const uniqueBuyers = uniqueBuyerIds.size;

    // Get posts and engagement data
    const { data: postsData } = await supabase
      .from('event_posts')
      .select('id')
      .in('event_id', eventIds)
      .gte('created_at', defaultFromDate)
      .lte('created_at', defaultToDate);

    const { data: engagementData } = await supabase.rpc('get_post_engagement_daily', {
      p_event_ids: eventIds,
      p_from_date: defaultFromDate.split('T')[0],
      p_to_date: defaultToDate.split('T')[0]
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