// Hook for fetching enhanced campaign analytics data

import { useQuery } from '@tanstack/react-query';
import {
  fetchCampaignDaily,
  fetchViewability,
  fetchAttribution,
  fetchCreativeDaily,
  fetchComparison,
} from '@/analytics/api/queries';
import type { DateRange } from '@/analytics/api/types';
import { useMemo } from 'react';

interface UseCampaignAnalyticsEnhancedOptions {
  campaignId: string;
  dateRange: DateRange;
  enabled?: boolean;
}

export function useCampaignAnalyticsEnhanced({
  campaignId,
  dateRange,
  enabled = true,
}: UseCampaignAnalyticsEnhancedOptions) {
  // Fetch daily metrics
  const dailyQuery = useQuery({
    queryKey: ['campaign-analytics-daily', campaignId, dateRange],
    queryFn: () => fetchCampaignDaily(campaignId, dateRange),
    enabled: enabled && !!campaignId,
  });

  // Fetch viewability metrics (30d rolling)
  const viewabilityQuery = useQuery({
    queryKey: ['campaign-analytics-viewability', campaignId],
    queryFn: () => fetchViewability(campaignId),
    enabled: enabled && !!campaignId,
  });

  // Fetch attribution data
  const attributionQuery = useQuery({
    queryKey: ['campaign-analytics-attribution', campaignId, dateRange],
    queryFn: () => fetchAttribution(campaignId, dateRange),
    enabled: enabled && !!campaignId,
  });

  // Fetch creative performance
  const creativeQuery = useQuery({
    queryKey: ['campaign-analytics-creative', campaignId, dateRange],
    queryFn: () => fetchCreativeDaily(campaignId, dateRange),
    enabled: enabled && !!campaignId,
  });

  // Fetch period-over-period comparison (last 7 days)
  const comparisonQuery = useQuery({
    queryKey: ['campaign-analytics-comparison', campaignId],
    queryFn: () => fetchComparison(campaignId, 7),
    enabled: enabled && !!campaignId,
  });

  // Calculate totals from daily data
  const totals = useMemo(() => {
    const daily = dailyQuery.data || [];
    return {
      impressions: daily.reduce((sum, row) => sum + row.impressions, 0),
      clicks: daily.reduce((sum, row) => sum + row.clicks, 0),
      conversions: daily.reduce((sum, row) => sum + row.conversions, 0),
      spend_credits: daily.reduce((sum, row) => sum + row.spend_credits, 0),
      value_cents: daily.reduce((sum, row) => sum + row.conversion_value_cents, 0),
    };
  }, [dailyQuery.data]);

  const isLoading =
    dailyQuery.isLoading ||
    viewabilityQuery.isLoading ||
    attributionQuery.isLoading ||
    creativeQuery.isLoading ||
    comparisonQuery.isLoading;

  const error =
    dailyQuery.error ||
    viewabilityQuery.error ||
    attributionQuery.error ||
    creativeQuery.error ||
    comparisonQuery.error;

  return {
    // Raw data
    daily: dailyQuery.data || [],
    viewability: viewabilityQuery.data || null,
    attribution: attributionQuery.data || [],
    creatives: creativeQuery.data || [],
    comparison: comparisonQuery.data,

    // Aggregated totals
    totals,

    // Loading states
    isLoading,
    error,

    // Refetch functions
    refetch: () => {
      dailyQuery.refetch();
      viewabilityQuery.refetch();
      attributionQuery.refetch();
      creativeQuery.refetch();
      comparisonQuery.refetch();
    },
  };
}

