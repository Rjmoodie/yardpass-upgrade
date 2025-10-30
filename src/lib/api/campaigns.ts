import { supabase } from '@/integrations/supabase/client';

export async function getCampaign(campaignId: string) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
  
  if (error) throw error;
  return data;
}

export async function getCampaignAnalytics(
  campaignId: string,
  orgId: string,
  from: Date, 
  to: Date
) {
  const { data, error } = await supabase
    .rpc('rpc_campaign_analytics_daily', {
      p_campaign_ids: [campaignId],
      p_from: from.toISOString().slice(0, 10), // YYYY-MM-DD format
      p_to: to.toISOString().slice(0, 10),
      p_org_id: orgId
    });
  
  if (error) throw error;
  
  // Transform to analytics format
  const series = data?.map((row: any) => ({
    date: row.date,
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    conversions: row.conversions || 0,
    spend_credits: row.credits_spent || 0
  })) || [];

  // Calculate totals
  const totals = series.reduce(
    (acc, point) => ({
      impressions: acc.impressions + point.impressions,
      clicks: acc.clicks + point.clicks,
      conversions: acc.conversions + point.conversions,
      spend_credits: acc.spend_credits + point.spend_credits,
    }),
    { impressions: 0, clicks: 0, conversions: 0, spend_credits: 0 }
  );

  return { series, totals };
}

export async function getCampaignMetrics(campaignId: string) {
  const { data, error } = await supabase
    .rpc('rpc_campaign_analytics_daily', {
      p_campaign_ids: [campaignId],
      p_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      p_to: new Date().toISOString(),
      p_org_id: '' // Will need org context
    });
  
  if (error) throw error;
  
  return {
    points: data?.map((row: any) => ({
      date: row.date,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      credits_spent: row.credits_spent || 0
    })) || []
  };
}
