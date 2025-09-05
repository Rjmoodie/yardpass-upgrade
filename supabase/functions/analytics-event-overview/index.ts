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
    const { event_id: eventId, from: fromDate, to: toDate } = await req.json();

    // Set default date range if not provided
    const defaultFromDate = fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const defaultToDate = toDate || new Date().toISOString();

    if (!eventId) {
      return new Response(JSON.stringify({ error: 'event_id required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Check if user has access to this event
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (!event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Check permissions
    let hasAccess = false;
    if (event.owner_context_type === 'individual' && event.owner_context_id === user.id) {
      hasAccess = true;
    } else if (event.owner_context_type === 'organization') {
      const { data: membership } = await supabase
        .from('org_memberships')
        .select('role')
        .eq('org_id', event.owner_context_id)
        .eq('user_id', user.id)
        .single();
      
      if (membership && ['viewer', 'editor', 'admin', 'owner'].includes(membership.role)) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Get event KPIs using database function
    const { data: kpisData } = await supabase.rpc('get_event_kpis_daily', {
      p_event_ids: [eventId],
      p_from_date: defaultFromDate.split('T')[0],
      p_to_date: defaultToDate.split('T')[0]
    });

    const totalRevenue = kpisData?.reduce((sum, row) => sum + row.gmv_cents, 0) || 0;
    const totalFees = kpisData?.reduce((sum, row) => sum + row.fees_cents, 0) || 0;
    const totalTickets = kpisData?.reduce((sum, row) => sum + row.units, 0) || 0;

    // Get ticket tiers and their performance
    const { data: tiers } = await supabase
      .from('ticket_tiers')
      .select('*')
      .eq('event_id', eventId);

    const { data: tierSales } = await supabase
      .from('order_items')
      .select(`
        tier_id, 
        quantity, 
        unit_price_cents,
        orders!order_items_order_id_fkey(status)
      `)
      .in('tier_id', tiers?.map(t => t.id) || [])
      .eq('orders.status', 'paid');

    const tierPerformance = tiers?.map(tier => {
      const sales = tierSales?.filter(s => s.tier_id === tier.id) || [];
      const soldCount = sales.reduce((sum, s) => sum + s.quantity, 0);
      const revenue = sales.reduce((sum, s) => sum + (s.quantity * s.unit_price_cents), 0);
      
      return {
        id: tier.id,
        name: tier.name,
        price_cents: tier.price_cents,
        quantity: tier.quantity,
        sold: soldCount,
        revenue: revenue,
        sell_through: tier.quantity ? (soldCount / tier.quantity) * 100 : 0
      };
    }) || [];

    // Get scan data using database function
    const { data: scanData } = await supabase.rpc('get_event_scans_daily', {
      p_event_ids: [eventId],
      p_from_date: defaultFromDate.split('T')[0],
      p_to_date: defaultToDate.split('T')[0]
    });

    const totalScans = scanData?.reduce((sum, row) => sum + row.scans, 0) || 0;
    const checkinRate = totalTickets > 0 ? (totalScans / totalTickets) * 100 : 0;

    // Get posts and engagement for this event
    const { data: postsData } = await supabase
      .from('event_posts')
      .select('id')
      .eq('event_id', eventId)
      .gte('created_at', defaultFromDate)
      .lte('created_at', defaultToDate);

    const { data: engagementData } = await supabase.rpc('get_post_engagement_daily', {
      p_event_ids: [eventId],
      p_from_date: defaultFromDate.split('T')[0],
      p_to_date: defaultToDate.split('T')[0]
    });

    const totalEngagements = engagementData?.reduce((sum, row) => 
      sum + row.likes + row.comments + row.shares, 0) || 0;

    // Sales curve data (cumulative)
    let cumulativeRevenue = 0;
    const salesCurve = kpisData?.map(row => {
      cumulativeRevenue += row.gmv_cents;
      return {
        date: row.d,
        cumulative_revenue: cumulativeRevenue,
        daily_revenue: row.gmv_cents,
        daily_units: row.units
      };
    }) || [];

    // Check-in timeline
    const checkinTimeline = scanData?.map(row => ({
      date: row.d,
      scans: row.scans,
      duplicates: row.dupes
    })) || [];

    const response = {
      event: {
        id: event.id,
        title: event.title,
        start_at: event.start_at,
        end_at: event.end_at
      },
      kpis: {
        gross_revenue: totalRevenue,
        net_revenue: totalRevenue - totalFees,
        platform_fees: totalFees,
        tickets_sold: totalTickets,
        capacity: tiers?.reduce((sum, t) => sum + (t.quantity || 0), 0) || 0,
        sell_through: tiers?.reduce((sum, t) => sum + (t.quantity || 0), 0) > 0 
          ? (totalTickets / tiers.reduce((sum, t) => sum + (t.quantity || 0), 0)) * 100 
          : 0,
        checkin_rate: Math.round(checkinRate * 100) / 100,
        posts_created: postsData?.length || 0,
        feed_engagements: totalEngagements
      },
      sales_curve: salesCurve,
      checkin_timeline: checkinTimeline,
      tier_performance: tierPerformance,
      scan_summary: {
        total_scans: totalScans,
        valid_scans: totalScans - (scanData?.reduce((sum, row) => sum + row.dupes, 0) || 0),
        duplicate_scans: scanData?.reduce((sum, row) => sum + row.dupes, 0) || 0
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Event analytics error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});