// Analytics V2 - Main Analytics Hook with Error Handling & Cached Fallback

import { useEffect, useState, useRef } from 'react';
import {
  fetchCampaignDaily,
  fetchViewability,
  fetchAttribution,
  fetchCreativeDaily,
} from '../api/queries';
import type { DateRange, AnalyticsData } from '../api/types';
import { logger } from '@/utils/logger';

interface AnalyticsState extends AnalyticsData {
  loading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
  isCached: boolean; // True if showing cached data due to query failure
}

/**
 * Retry a query with exponential backoff
 */
async function queryWithRetry<T>(
  queryFn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      logger.debug(`[Analytics] Retry attempt ${attempt + 1}/${maxRetries}`, {
        delay: `${delayMs}ms`,
      });
    }
  }
  
  throw lastError!;
}

/**
 * Main hook for fetching campaign analytics
 * Features:
 * - Retry logic with exponential backoff
 * - Cached fallback on query failures
 * - Data freshness tracking
 * - Degraded mode support
 */
export function useAnalytics(campaignId: string, range: DateRange) {
  const [state, setState] = useState<AnalyticsState>({
    daily: [],
    viewability: null,
    attribution: [],
    creatives: [],
    loading: true,
    error: null,
    lastUpdated: null,
    isCached: false,
  });

  // Store cached data in ref to persist across re-renders
  const cachedDataRef = useRef<AnalyticsData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      if (!campaignId) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      setState(prev => ({ 
        ...prev, 
        loading: true, 
        error: null,
        isCached: false,
      }));

      try {
        // Fetch all analytics in parallel with retry
        const [daily, viewability, attribution, creatives] = await Promise.all([
          queryWithRetry(() => fetchCampaignDaily(campaignId, range)),
          queryWithRetry(() => fetchViewability(campaignId)),
          queryWithRetry(() => fetchAttribution(campaignId, range)),
          queryWithRetry(() => fetchCreativeDaily(campaignId, range)),
        ]);

        if (!cancelled) {
          const newData: AnalyticsData = { daily, viewability, attribution, creatives };
          cachedDataRef.current = newData; // Update cache
          
          setState({
            ...newData,
            loading: false,
            error: null,
            lastUpdated: new Date(),
            isCached: false,
          });
        }
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          logger.error('[Analytics] Failed to load analytics', error, {
            campaignId,
            dateRange: range,
          });

          // Use cached data if available (degraded mode)
          if (cachedDataRef.current) {
            logger.info('[Analytics] Falling back to cached data', {
              campaignId,
              cachedAt: cachedDataRef.current ? 'previous load' : 'none',
            });
            
            setState({
              ...cachedDataRef.current,
              loading: false,
              error,
              lastUpdated: state.lastUpdated, // Keep previous timestamp
              isCached: true, // Show degraded mode banner
            });
          } else {
            // No cached data - show error state
            setState(prev => ({
              ...prev,
              loading: false,
              error,
              isCached: false,
            }));
          }
        }
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [campaignId, range.from, range.to]);

  return state;
}




