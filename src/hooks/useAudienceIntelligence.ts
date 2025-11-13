/**
 * Audience Intelligence Hooks
 * TanStack Query wrappers for audience analytics RPCs
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// =====================================================================
// QUERY KEYS
// =====================================================================

export const audienceKeys = {
  all: ['audience'] as const,
  org: (orgId: string) => [...audienceKeys.all, orgId] as const,
  overview: (orgId: string, from: string, to: string) =>
    [...audienceKeys.org(orgId), 'overview', from, to] as const,
  acquisition: (orgId: string, from: string, to: string) =>
    [...audienceKeys.org(orgId), 'acquisition', from, to] as const,
  deviceNetwork: (orgId: string, from: string, to: string) =>
    [...audienceKeys.org(orgId), 'device-network', from, to] as const,
  cohorts: (orgId: string, weeks: number) =>
    [...audienceKeys.org(orgId), 'cohorts', weeks] as const,
  paths: (orgId: string, from: string, to: string) =>
    [...audienceKeys.org(orgId), 'paths', from, to] as const,
  highIntent: (orgId: string, hours: number) =>
    [...audienceKeys.org(orgId), 'high-intent', hours] as const,
  segments: (orgId: string) =>
    [...audienceKeys.org(orgId), 'segments'] as const,
};

// =====================================================================
// AUDIENCE OVERVIEW
// =====================================================================

export interface AudienceOverview {
  visitors: number;
  sessions: number;
  new_buyers: number;
  returning_buyers: number;
  checkout_start_rate: number;
  purchase_rate: number;
  unique_buyers: number;
  gross_revenue_cents: number;
  net_revenue_cents: number;
  aov_cents: number;
  mobile_conversion_rate: number;
  desktop_conversion_rate: number;
}

export function useAudienceOverview(
  orgId: string | null,
  from: Date | string,
  to: Date | string,
  options?: Omit<UseQueryOptions<AudienceOverview>, 'queryKey' | 'queryFn'>
) {
  const fromStr = typeof from === 'string' ? from : from.toISOString();
  const toStr = typeof to === 'string' ? to : to.toISOString();
  
  return useQuery<AudienceOverview>({
    queryKey: orgId ? audienceKeys.overview(orgId, fromStr, toStr) : ['audience', 'none'],
    queryFn: async () => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_audience_overview', {
        p_org_id: orgId,
        p_from: fromStr,
        p_to: toStr
      });
      
      if (error) throw error;
      return data as AudienceOverview;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 10 * 60 * 1000,
    retry: 2,
    ...options,
  });
}

// =====================================================================
// ACQUISITION QUALITY
// =====================================================================

export interface AcquisitionQuality {
  source: string;
  medium: string;
  campaign: string;
  visitors: number;
  ctas: number;
  checkouts: number;
  purchases: number;
  revenue_cents: number;
  refund_rate: number;
  aov_cents: number;
  ltv_cents: number;
  ctr: number;
  purchase_rate: number;
}

export function useAcquisitionQuality(
  orgId: string | null,
  from: Date | string,
  to: Date | string,
  limit: number = 50,
  options?: Omit<UseQueryOptions<AcquisitionQuality[]>, 'queryKey' | 'queryFn'>
) {
  const fromStr = typeof from === 'string' ? from : from.toISOString();
  const toStr = typeof to === 'string' ? to : to.toISOString();
  
  return useQuery<AcquisitionQuality[]>({
    queryKey: orgId ? audienceKeys.acquisition(orgId, fromStr, toStr) : ['audience', 'none'],
    queryFn: async () => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_audience_acquisition', {
        p_org_id: orgId,
        p_from: fromStr,
        p_to: toStr,
        p_limit: limit
      });
      
      if (error) throw error;
      return data as AcquisitionQuality[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    ...options,
  });
}

// =====================================================================
// DEVICE & NETWORK PERFORMANCE
// =====================================================================

export interface DeviceNetworkPerformance {
  device: string;
  network: string;
  sessions: number;
  purchases: number;
  conversion_rate: number;
  avg_page_load_ms: number;
}

export function useDeviceNetwork(
  orgId: string | null,
  from: Date | string,
  to: Date | string,
  options?: Omit<UseQueryOptions<DeviceNetworkPerformance[]>, 'queryKey' | 'queryFn'>
) {
  const fromStr = typeof from === 'string' ? from : from.toISOString();
  const toStr = typeof to === 'string' ? to : to.toISOString();
  
  return useQuery<DeviceNetworkPerformance[]>({
    queryKey: orgId ? audienceKeys.deviceNetwork(orgId, fromStr, toStr) : ['audience', 'none'],
    queryFn: async () => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_audience_device_network', {
        p_org_id: orgId,
        p_from: fromStr,
        p_to: toStr
      });
      
      if (error) throw error;
      return data as DeviceNetworkPerformance[];
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,  // 10 minutes (less volatile)
    gcTime: 15 * 60 * 1000,
    retry: 2,
    ...options,
  });
}

// =====================================================================
// COHORT RETENTION
// =====================================================================

export interface CohortRetention {
  cohort_week: string;
  week_offset: number;
  buyers: number;
  retention_rate: number;
}

export function useCohortRetention(
  orgId: string | null,
  weeks: number = 12,
  options?: Omit<UseQueryOptions<CohortRetention[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<CohortRetention[]>({
    queryKey: orgId ? audienceKeys.cohorts(orgId, weeks) : ['audience', 'none'],
    queryFn: async () => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_audience_cohorts', {
        p_org_id: orgId,
        p_weeks: weeks
      });
      
      if (error) throw error;
      return data as CohortRetention[];
    },
    enabled: !!orgId,
    staleTime: 30 * 60 * 1000,  // 30 minutes (slow-changing)
    gcTime: 60 * 60 * 1000,
    retry: 2,
    ...options,
  });
}

// =====================================================================
// USER PATHWAYS
// =====================================================================

export interface UserPath {
  path: string;
  users: number;
  avg_time_to_purchase_minutes: number;
  conversion_rate: number;
}

export function useUserPaths(
  orgId: string | null,
  from: Date | string,
  to: Date | string,
  limit: number = 20,
  options?: Omit<UseQueryOptions<UserPath[]>, 'queryKey' | 'queryFn'>
) {
  const fromStr = typeof from === 'string' ? from : from.toISOString();
  const toStr = typeof to === 'string' ? to : to.toISOString();
  
  return useQuery<UserPath[]>({
    queryKey: orgId ? audienceKeys.paths(orgId, fromStr, toStr) : ['audience', 'none'],
    queryFn: async () => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_audience_paths', {
        p_org_id: orgId,
        p_from: fromStr,
        p_to: toStr,
        p_limit: limit
      });
      
      if (error) throw error;
      return data as UserPath[];
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
    ...options,
  });
}

// =====================================================================
// HIGH-INTENT VISITORS (Real-time Hot Leads)
// =====================================================================

export interface HighIntentVisitor {
  user_id: string;
  display_name: string;
  propensity_score: number;
  recent_events: string[];
  last_activity: string;
}

export function useHighIntentVisitors(
  orgId: string | null,
  hours: number = 24,
  minScore: number = 7,
  options?: Omit<UseQueryOptions<HighIntentVisitor[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<HighIntentVisitor[]>({
    queryKey: orgId ? audienceKeys.highIntent(orgId, hours) : ['audience', 'none'],
    queryFn: async () => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_high_intent_visitors', {
        p_org_id: orgId,
        p_hours: hours,
        p_min_score: minScore
      });
      
      if (error) throw error;
      return data as HighIntentVisitor[];
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,  // 2 minutes (real-time)
    gcTime: 5 * 60 * 1000,
    retry: 2,
    refetchInterval: 5 * 60 * 1000,  // Auto-refresh every 5 minutes
    ...options,
  });
}

// =====================================================================
// SEGMENTS
// =====================================================================

export interface AudienceSegment {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  definition: Record<string, any>;
  size_estimate: number;
  export_count: number;
  created_by: string;
  is_shared: boolean;
  created_at: string;
}

export function useAudienceSegments(
  orgId: string | null,
  options?: Omit<UseQueryOptions<AudienceSegment[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<AudienceSegment[]>({
    queryKey: orgId ? audienceKeys.segments(orgId) : ['audience', 'segments', 'none'],
    queryFn: async () => {
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from('analytics.audience_segments')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AudienceSegment[];
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,  // 1 minute
    gcTime: 5 * 60 * 1000,
    ...options,
  });
}

// Mutation: Create segment
export function useCreateSegment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (segment: {
      org_id: string;
      name: string;
      description?: string;
      definition: Record<string, any>;
    }) => {
      const { data, error } = await supabase
        .from('analytics.audience_segments')
        .insert(segment)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: audienceKeys.segments(variables.org_id) });
      toast({ title: 'Segment created successfully' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to create segment',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });
}

// Mutation: Export segment
export function useExportSegment() {
  return useMutation({
    mutationFn: async (params: {
      segmentId: string;
      includePII: boolean;
      format: 'csv' | 'json';
      purpose?: string;
    }) => {
      // Materialize segment
      const { data, error } = await supabase.rpc('materialize_segment', {
        p_segment_id: params.segmentId
      });
      
      if (error) throw error;
      
      // Log export
      await supabase.from('analytics.segment_export_log').insert({
        segment_id: params.segmentId,
        user_count: data?.length || 0,
        included_pii: params.includePII,
        export_format: params.format,
        purpose: params.purpose
      });
      
      return data;
    },
    onSuccess: (data, variables) => {
      // Download file
      const content = variables.format === 'json'
        ? JSON.stringify(data, null, 2)
        : convertToCSV(data);
      
      const blob = new Blob([content], {
        type: variables.format === 'json' ? 'application/json' : 'text/csv'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `segment-export-${new Date().toISOString()}.${variables.format}`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ 
        title: 'Segment exported',
        description: `${data.length} users exported`
      });
    },
    onError: (error) => {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });
}

// Helper: Convert to CSV
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const rows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => JSON.stringify(row[h] || '')).join(',')
    )
  ];
  
  return rows.join('\n');
}

// =====================================================================
// PREFETCH UTILITIES
// =====================================================================

export function usePrefetchAudience(queryClient: any) {
  const prefetchOverview = (orgId: string, from: string, to: string) => {
    queryClient.prefetchQuery({
      queryKey: audienceKeys.overview(orgId, from, to),
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_audience_overview', {
          p_org_id: orgId,
          p_from: from,
          p_to: to
        });
        if (error) throw error;
        return data;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
  
  const prefetchAcquisition = (orgId: string, from: string, to: string) => {
    queryClient.prefetchQuery({
      queryKey: audienceKeys.acquisition(orgId, from, to),
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_audience_acquisition', {
          p_org_id: orgId,
          p_from: from,
          p_to: to,
          p_limit: 50
        });
        if (error) throw error;
        return data;
      },
      staleTime: 5 * 60 * 1000,
    });
  };
  
  return { prefetchOverview, prefetchAcquisition };
}

