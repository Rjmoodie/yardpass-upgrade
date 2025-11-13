/**
 * Hook for internal audience analytics
 * Replaces PostHog with first-party database queries
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FunnelStep {
  stage: string;
  users: number;
  sessions?: number;
  conversion_rate: number;
  gross_revenue_cents?: number;
  net_revenue_cents?: number;
}

export interface AcquisitionChannel {
  channel: string;
  visitors: number;
  purchasers: number;
  conversion_rate: number;
  net_revenue_cents: number;
}

export interface DeviceBreakdown {
  device: string;
  sessions: number;
  conversion_rate: number;
}

export interface TopEvent {
  event_id: string;
  title: string;
  views: number;
  ctr: number;
  purchasers: number;
  net_revenue_cents: number;
}

export interface InternalAudienceData {
  meta: {
    org_id: string;
    from: string;
    to: string;
    attribution: string;
    source: string;
  };
  funnel_steps: FunnelStep[];
  acquisition_channels: AcquisitionChannel[];
  device_breakdown: DeviceBreakdown[];
  top_events: TopEvent[];
  total_conversion_rate: number;
}

export interface UseInternalAudienceAnalyticsOptions {
  orgId: string;
  from: Date | string;
  to: Date | string;
  eventIds?: string[];
  useCache?: boolean;
  attribution?: 'first_touch' | 'last_touch';
  includeRefunds?: boolean;
}

export function useInternalAudienceAnalytics() {
  const [data, setData] = useState<InternalAudienceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (options: UseInternalAudienceAnalyticsOptions) => {
    setLoading(true);
    setError(null);

    try {
      const fromDate = typeof options.from === 'string' 
        ? options.from 
        : options.from.toISOString();
      
      const toDate = typeof options.to === 'string' 
        ? options.to 
        : options.to.toISOString();

      // Call the cached RPC for better performance
      const { data: result, error: rpcError } = await supabase.rpc(
        'get_audience_funnel_cached',
        {
          p_org_id: options.orgId,
          p_from: fromDate,
          p_to: toDate,
          p_event_ids: options.eventIds || null,
          p_use_cache: options.useCache !== false  // Default true
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message || 'Failed to fetch analytics');
      }

      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useInternalAudienceAnalytics] Error:', errorMessage);
      setError(errorMessage);
      
      // Set fallback data on error
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch without changing loading state (for real-time updates)
  const refetch = useCallback(async (options: UseInternalAudienceAnalyticsOptions) => {
    try {
      const fromDate = typeof options.from === 'string' 
        ? options.from 
        : options.from.toISOString();
      
      const toDate = typeof options.to === 'string' 
        ? options.to 
        : options.to.toISOString();

      const { data: result, error: rpcError } = await supabase.rpc(
        'get_audience_funnel_cached',
        {
          p_org_id: options.orgId,
          p_from: fromDate,
          p_to: toDate,
          p_event_ids: options.eventIds || null,
          p_use_cache: options.useCache !== false
        }
      );

      if (!rpcError && result) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      console.error('[useInternalAudienceAnalytics] Refetch error:', err);
    }
  }, []);

  return {
    data,
    loading,
    error,
    fetchAnalytics,
    refetch
  };
}

/**
 * Hook for leaky step analysis
 */
export function useLeakyStepsAnalysis() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeakySteps = useCallback(async (
    orgId: string,
    from: Date | string,
    to: Date | string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const fromDate = typeof from === 'string' ? from : from.toISOString();
      const toDate = typeof to === 'string' ? to : to.toISOString();

      const { data: result, error: rpcError } = await supabase.rpc(
        'get_leaky_steps_analysis',
        {
          p_org_id: orgId,
          p_from: fromDate,
          p_to: toDate
        }
      );

      if (rpcError) throw rpcError;
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useLeakyStepsAnalysis] Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchLeakySteps };
}

/**
 * Hook for creative diagnostics
 */
export function useCreativeDiagnostics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = useCallback(async (
    orgId: string,
    from: Date | string,
    to: Date | string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const fromDate = typeof from === 'string' ? from : from.toISOString();
      const toDate = typeof to === 'string' ? to : to.toISOString();

      const { data: result, error: rpcError } = await supabase.rpc(
        'get_creative_diagnostics',
        {
          p_org_id: orgId,
          p_from: fromDate,
          p_to: toDate
        }
      );

      if (rpcError) throw rpcError;
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[useCreativeDiagnostics] Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchDiagnostics };
}

