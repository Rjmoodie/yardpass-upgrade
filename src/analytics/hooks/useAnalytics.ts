// Analytics V2 - Main Analytics Hook

import { useEffect, useState } from 'react';
import {
  fetchCampaignDaily,
  fetchViewability,
  fetchAttribution,
  fetchCreativeDaily,
} from '../api/queries';
import type { DateRange, AnalyticsData } from '../api/types';

/**
 * Main hook for fetching campaign analytics
 * Fetches all analytics data in parallel
 */
export function useAnalytics(campaignId: string, range: DateRange) {
  const [data, setData] = useState<AnalyticsData>({
    daily: [],
    viewability: null,
    attribution: [],
    creatives: [],
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
        // Fetch all analytics in parallel
        const [daily, viewability, attribution, creatives] = await Promise.all([
          fetchCampaignDaily(campaignId, range),
          fetchViewability(campaignId),
          fetchAttribution(campaignId, range),
          fetchCreativeDaily(campaignId, range),
        ]);

        if (!cancelled) {
          setData({ daily, viewability, attribution, creatives });
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
  }, [campaignId, range.from, range.to]);

  return { ...data, loading, error };
}


