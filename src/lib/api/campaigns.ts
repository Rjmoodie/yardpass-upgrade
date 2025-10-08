import { supabase } from '@/integrations/supabase/client';

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
