import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VideoErrorSummary {
  error_type: string;
  error_count: number;
  affected_playbacks: number;
  affected_posts: number;
  affected_events: number;
}

export interface VideoPerformanceSummary {
  metric: string;
  avg_value_ms: number;
  median_value_ms: number;
  p95_value_ms: number;
  sample_count: number;
}

export interface VideoAnalyticsSummary {
  error_summary: VideoErrorSummary[];
  performance_summary: VideoPerformanceSummary[];
  total_errors: number;
  total_metrics: number;
}

export interface VideoErrorDaily {
  date: string;
  error_type: string;
  error_count: number;
  affected_playbacks: number;
}

export interface VideoPerformanceDaily {
  date: string;
  metric: string;
  sample_count: number;
  avg_value_ms: number;
  median_value_ms: number;
  p95_value_ms: number;
}

/**
 * Hook to fetch video analytics summary (errors + performance)
 */
export function useVideoAnalyticsSummary(options?: {
  orgId?: string | null;
  eventId?: string | null;
  days?: number;
}) {
  const { orgId, eventId, days = 30 } = options || {};

  return useQuery({
    queryKey: ['video-analytics-summary', orgId, eventId, days],
    queryFn: async (): Promise<VideoAnalyticsSummary> => {
      const { data, error } = await supabase.rpc('get_video_analytics_summary', {
        p_org_id: orgId || null,
        p_event_id: eventId || null,
        p_days: days,
      });

      if (error) {
        console.error('Error fetching video analytics summary:', error);
        throw error;
      }

      return data as VideoAnalyticsSummary;
    },
    enabled: true, // Always enabled - can work without orgId
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to fetch daily error rates
 */
export function useVideoErrorRatesDaily(days: number = 30) {
  return useQuery({
    queryKey: ['video-error-rates-daily', days],
    queryFn: async (): Promise<VideoErrorDaily[]> => {
      const { data, error } = await supabase
        .from('video_error_rates_daily')
        .select('*')
        .order('date', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching daily error rates:', error);
        throw error;
      }

      return (data || []) as VideoErrorDaily[];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch daily performance metrics
 */
export function useVideoPerformanceDaily(days: number = 30) {
  return useQuery({
    queryKey: ['video-performance-daily', days],
    queryFn: async (): Promise<VideoPerformanceDaily[]> => {
      const { data, error } = await supabase
        .from('video_performance_daily')
        .select('*')
        .order('date', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching daily performance metrics:', error);
        throw error;
      }

      return (data || []) as VideoPerformanceDaily[];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

