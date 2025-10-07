import { supabase } from '@/integrations/supabase/client';

export async function getCampaignMetrics(campaignId: string) {
  const { data, error } = await supabase
    .rpc('rpc_campaign_analytics_daily', {
      campaign_id: campaignId,
      days_back: 30
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
