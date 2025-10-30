// Analytics V2 - Data Fetching Functions

import { supabase } from '@/integrations/supabase/client';
import type { DateRange, DailyRow, ViewabilityRow, AttributionRow, CreativeDailyRow, ComparisonRow, ComparisonData } from './types';

/**
 * Fetch daily campaign metrics from materialized view
 * Uses cached data (refreshed every 5 minutes)
 */
export async function fetchCampaignDaily(campaignId: string, range: DateRange): Promise<DailyRow[]> {
  const { data, error } = await supabase
    .from('analytics_campaign_daily_mv')
    .select('*')
    .eq('campaign_id', campaignId)
    .gte('day', range.from)
    .lte('day', range.to)
    .order('day', { ascending: true });

  if (error) {
    console.error('[ANALYTICS] Failed to fetch daily metrics:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch viewability quality metrics (30-day rolling window)
 */
export async function fetchViewability(campaignId: string): Promise<ViewabilityRow | null> {
  const { data, error } = await supabase
    .from('analytics_viewability_campaign')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle();

  if (error) {
    console.error('[ANALYTICS] Failed to fetch viewability:', error);
    throw error;
  }

  return data;
}

/**
 * Fetch attribution breakdown (last-click vs view-through)
 */
export async function fetchAttribution(campaignId: string, range: DateRange): Promise<AttributionRow[]> {
  const { data, error } = await supabase
    .from('analytics_attribution_campaign')
    .select('*')
    .eq('campaign_id', campaignId)
    .gte('day', range.from)
    .lte('day', range.to)
    .order('day', { ascending: true });

  if (error) {
    console.error('[ANALYTICS] Failed to fetch attribution:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch creative performance metrics
 */
export async function fetchCreativeDaily(campaignId: string, range: DateRange): Promise<CreativeDailyRow[]> {
  const { data, error } = await supabase
    .from('analytics_creative_daily')
    .select('*')
    .eq('campaign_id', campaignId)
    .gte('day', range.from)
    .lte('day', range.to)
    .order('day', { ascending: true });

  if (error) {
    console.error('[ANALYTICS] Failed to fetch creative metrics:', error);
    throw error;
  }

  return data || [];
}

/**
 * Manually trigger analytics refresh
 * (Normally handled by cron job, but useful for testing)
 */
export async function triggerRefresh(): Promise<void> {
  const { error } = await supabase.rpc('refresh_analytics');

  if (error) {
    console.error('[ANALYTICS] Failed to refresh:', error);
    throw error;
  }

  console.log('[ANALYTICS] ✅ Refresh triggered');
}

/**
 * Fetch period-over-period comparison
 * Shows current vs previous period metrics with % change
 */
export async function fetchComparison(campaignId: string, days: number = 7): Promise<ComparisonData> {
  const { data, error } = await supabase.rpc('get_campaign_kpis_comparison', {
    p_campaign_id: campaignId,
    p_days: days
  });

  if (error) {
    console.error('[ANALYTICS] Failed to fetch comparison:', error);
    throw error;
  }

  const rows = (data || []) as ComparisonRow[];
  
  // Convert array to object for easier access
  const comparisonMap: Partial<ComparisonData> = {};
  rows.forEach((row) => {
    comparisonMap[row.metric as keyof ComparisonData] = row;
  });

  // Return with defaults for missing metrics
  return {
    impressions: comparisonMap.impressions || { metric: 'impressions', current_value: 0, previous_value: 0, change_pct: 0 },
    clicks: comparisonMap.clicks || { metric: 'clicks', current_value: 0, previous_value: 0, change_pct: 0 },
    conversions: comparisonMap.conversions || { metric: 'conversions', current_value: 0, previous_value: 0, change_pct: 0 },
    spend: comparisonMap.spend || { metric: 'spend', current_value: 0, previous_value: 0, change_pct: 0 },
    revenue: comparisonMap.revenue || { metric: 'revenue', current_value: 0, previous_value: 0, change_pct: 0 },
  };
}

