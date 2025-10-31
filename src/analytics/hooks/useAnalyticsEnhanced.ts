// Enhanced Analytics Hook with Period Comparison
// Extends base useAnalytics with comparison data

import { useEffect, useState } from 'react';
import {
  fetchCampaignDaily,
  fetchViewability,
  fetchAttribution,
  fetchCreativeDaily,
  fetchComparison,
} from '../api/queries';
import type { DateRange, AnalyticsData, ComparisonData } from '../api/types';

interface EnhancedAnalyticsData extends AnalyticsData {
  comparison: ComparisonData | null;
}

/**
 * Enhanced hook for fetching campaign analytics with period comparison
 * Adds "vs previous period" metrics
 */
export function useAnalyticsEnhanced(campaignId: string, range: DateRange, days: number = 7) {
  const [data, setData] = useState<EnhancedAnalyticsData>({
    daily: [],
    viewability: null,
    attribution: [],
    creatives: [],
    comparison: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      if (!campaignId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch all analytics in parallel (including comparison)
        const [daily, viewability, attribution, creatives, comparison] = await Promise.all([
          fetchCampaignDaily(campaignId, range),
          fetchViewability(campaignId),
          fetchAttribution(campaignId, range),
          fetchCreativeDaily(campaignId, range),
          fetchComparison(campaignId, days),
        ]);

        if (!cancelled) {
          setData({ daily, viewability, attribution, creatives, comparison });
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[ANALYTICS] Failed to load:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [campaignId, range.from, range.to, days]);

  return { ...data, loading, error };
}




