import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const orgId = url.searchParams.get('org_id');
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');

    if (!orgId || !fromDate || !toDate) {
      return new Response(JSON.stringify({ error: 'org_id, from, and to are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get campaigns for this org
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('org_id', orgId);

    const campaignIds = campaigns?.map((c) => c.id) || [];

    if (campaignIds.length === 0) {
      return new Response(
        JSON.stringify({
          totals: { impressions: 0, clicks: 0, ctr: 0, credits_spent: 0 },
          series: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate impressions
    const { data: impressions } = await supabase
      .from('ad_impressions')
      .select('created_at, campaign_id')
      .in('campaign_id', campaignIds)
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    // Aggregate clicks
    const { data: clicks } = await supabase
      .from('ad_clicks')
      .select('created_at, campaign_id')
      .in('campaign_id', campaignIds)
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    // Aggregate spend
    const { data: spend } = await supabase
      .from('ad_spend_ledger')
      .select('occurred_at, credits_charged')
      .in('campaign_id', campaignIds)
      .gte('occurred_at', fromDate)
      .lte('occurred_at', toDate);

    // Build daily series
    const dayMap: Record<string, { impressions: number; clicks: number; credits_spent: number }> = {};
    
    impressions?.forEach((imp) => {
      const day = imp.created_at.split('T')[0];
      if (!dayMap[day]) dayMap[day] = { impressions: 0, clicks: 0, credits_spent: 0 };
      dayMap[day].impressions++;
    });

    clicks?.forEach((click) => {
      const day = click.created_at.split('T')[0];
      if (!dayMap[day]) dayMap[day] = { impressions: 0, clicks: 0, credits_spent: 0 };
      dayMap[day].clicks++;
    });

    spend?.forEach((s) => {
      const day = s.occurred_at.split('T')[0];
      if (!dayMap[day]) dayMap[day] = { impressions: 0, clicks: 0, credits_spent: 0 };
      dayMap[day].credits_spent += s.credits_charged;
    });

    const series = Object.entries(dayMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalImpressions = impressions?.length || 0;
    const totalClicks = clicks?.length || 0;
    const totalSpent = spend?.reduce((sum, s) => sum + s.credits_charged, 0) || 0;
    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

    return new Response(
      JSON.stringify({
        totals: {
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr,
          credits_spent: totalSpent,
        },
        series,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error fetching campaign analytics:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
