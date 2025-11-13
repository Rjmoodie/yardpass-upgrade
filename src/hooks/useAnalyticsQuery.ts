/**
 * TanStack Query wrappers for analytics
 * Provides caching, retries, deduplication, and background refresh
 */

import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  parseAudienceFunnel, 
  parseOrgAnalytics,
  type AudienceFunnel,
  type OrgAnalytics,
  type EnhancedFunnel,
  type ComparisonPeriod
} from '@/types/analytics';

// =====================================================================
// QUERY KEYS
// =====================================================================

export const analyticsKeys = {
  all: ['analytics'] as const,
  org: (orgId: string) => [...analyticsKeys.all, 'org', orgId] as const,
  orgOverview: (orgId: string, dateRange: string) => 
    [...analyticsKeys.org(orgId), 'overview', dateRange] as const,
  audience: (orgId: string, from: string, to: string) =>
    [...analyticsKeys.org(orgId), 'audience', from, to] as const,
  audienceEnhanced: (orgId: string, from: string, to: string, compareType?: string) =>
    [...analyticsKeys.audience(orgId, from, to), 'enhanced', compareType] as const,
  leakySteps: (orgId: string, from: string, to: string) =>
    [...analyticsKeys.org(orgId), 'leaky-steps', from, to] as const,
  creativeDiagnostics: (orgId: string, from: string, to: string) =>
    [...analyticsKeys.org(orgId), 'creative', from, to] as const,
  savedViews: (orgId: string) =>
    [...analyticsKeys.org(orgId), 'saved-views'] as const,
};

// =====================================================================
// ORG OVERVIEW
// =====================================================================

export function useOrgOverview(
  orgId: string | null | undefined,
  dateRange: string,
  options?: Omit<UseQueryOptions<OrgAnalytics>, 'queryKey' | 'queryFn'>
) {
  return useQuery<OrgAnalytics>({
    queryKey: orgId ? analyticsKeys.orgOverview(orgId, dateRange) : ['analytics', 'none'],
    queryFn: async ({ signal }) => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { from, to } = getDateRangeFromKey(dateRange);
      
      const { data, error } = await supabase.functions.invoke(
        'analytics-org-overview',
        {
          body: { org_id: orgId, from, to },
        }
      );
      
      if (error) throw error;
      return parseOrgAnalytics(data);
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 10 * 60 * 1000,  // 10 minutes (formerly cacheTime)
    retry: 2,
    ...options,
  });
}

// =====================================================================
// AUDIENCE FUNNEL
// =====================================================================

export function useAudienceFunnel(
  orgId: string | null | undefined,
  from: Date | string,
  to: Date | string,
  options?: Omit<UseQueryOptions<AudienceFunnel>, 'queryKey' | 'queryFn'>
) {
  const fromStr = typeof from === 'string' ? from : from.toISOString();
  const toStr = typeof to === 'string' ? to : to.toISOString();
  
  return useQuery<AudienceFunnel>({
    queryKey: orgId ? analyticsKeys.audience(orgId, fromStr, toStr) : ['analytics', 'none'],
    queryFn: async ({ signal }) => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_audience_funnel_cached', {
        p_org_id: orgId,
        p_from: fromStr,
        p_to: toStr,
        p_event_ids: null,
        p_use_cache: true
      });
      
      if (error) throw error;
      return parseAudienceFunnel(data);
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    ...options,
  });
}

// =====================================================================
// ENHANCED FUNNEL (with comparisons, targets, benchmarks)
// =====================================================================

export function useEnhancedFunnel(
  orgId: string | null | undefined,
  from: Date | string,
  to: Date | string,
  compareType?: ComparisonPeriod,
  options?: Omit<UseQueryOptions<EnhancedFunnel>, 'queryKey' | 'queryFn'>
) {
  const fromStr = typeof from === 'string' ? from : from.toISOString();
  const toStr = typeof to === 'string' ? to : to.toISOString();
  
  return useQuery<EnhancedFunnel>({
    queryKey: orgId ? analyticsKeys.audienceEnhanced(orgId, fromStr, toStr, compareType) : ['analytics', 'none'],
    queryFn: async ({ signal }) => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_funnel_enhanced', {
        p_org_id: orgId,
        p_from: fromStr,
        p_to: toStr,
        p_compare_period: compareType || null,
        p_include_targets: true,
        p_include_benchmarks: true
      });
      
      if (error) throw error;
      return data as EnhancedFunnel;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    ...options,
  });
}

// =====================================================================
// LEAKY STEPS ANALYSIS
// =====================================================================

export function useLeakySteps(
  orgId: string | null | undefined,
  from: Date | string,
  to: Date | string,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) {
  const fromStr = typeof from === 'string' ? from : from.toISOString();
  const toStr = typeof to === 'string' ? to : to.toISOString();
  
  return useQuery({
    queryKey: orgId ? analyticsKeys.leakySteps(orgId, fromStr, toStr) : ['analytics', 'none'],
    queryFn: async ({ signal }) => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_leaky_steps_analysis', {
        p_org_id: orgId,
        p_from: fromStr,
        p_to: toStr
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,  // 10 minutes (less frequently changing)
    gcTime: 15 * 60 * 1000,
    retry: 2,
    ...options,
  });
}

// =====================================================================
// CREATIVE DIAGNOSTICS
// =====================================================================

export function useCreativeDiagnostics(
  orgId: string | null | undefined,
  from: Date | string,
  to: Date | string,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) {
  const fromStr = typeof from === 'string' ? from : from.toISOString();
  const toStr = typeof to === 'string' ? to : to.toISOString();
  
  return useQuery({
    queryKey: orgId ? analyticsKeys.creativeDiagnostics(orgId, fromStr, toStr) : ['analytics', 'none'],
    queryFn: async ({ signal }) => {
      if (!orgId) throw new Error('No org ID provided');
      
      const { data, error } = await supabase.rpc('get_creative_diagnostics', {
        p_org_id: orgId,
        p_from: fromStr,
        p_to: toStr
      });
      
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
    ...options,
  });
}

// =====================================================================
// SAVED VIEWS
// =====================================================================

export function useSavedViews(
  orgId: string | null | undefined,
  options?: Omit<UseQueryOptions<any[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: orgId ? analyticsKeys.savedViews(orgId) : ['analytics', 'saved-views', 'none'],
    queryFn: async () => {
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from('analytics.saved_views')
        .select('*')
        .or(`org_id.eq.${orgId},user_id.eq.${(await supabase.auth.getUser()).data.user?.id}`)
        .order('last_accessed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,  // 1 minute
    gcTime: 5 * 60 * 1000,
    ...options,
  });
}

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

function getDateRangeFromKey(key: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  
  let from: Date;
  switch (key) {
    case '7d':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  return { from: from.toISOString(), to };
}

/**
 * Prefetch analytics data on hover
 */
export function usePrefetchAnalytics(queryClient: any) {
  const prefetchOrgOverview = (orgId: string, dateRange: string) => {
    queryClient.prefetchQuery({
      queryKey: analyticsKeys.orgOverview(orgId, dateRange),
      queryFn: async () => {
        const { from, to } = getDateRangeFromKey(dateRange);
        const { data, error } = await supabase.functions.invoke('analytics-org-overview', {
          body: { org_id: orgId, from, to }
        });
        if (error) throw error;
        return parseOrgAnalytics(data);
      },
      staleTime: 5 * 60 * 1000,
    });
  };
  
  const prefetchAudience = (orgId: string, from: string, to: string) => {
    queryClient.prefetchQuery({
      queryKey: analyticsKeys.audience(orgId, from, to),
      queryFn: async () => {
        const { data, error } = await supabase.rpc('get_audience_funnel_cached', {
          p_org_id: orgId,
          p_from: from,
          p_to: to,
          p_event_ids: null,
          p_use_cache: true
        });
        if (error) throw error;
        return parseAudienceFunnel(data);
      },
      staleTime: 5 * 60 * 1000,
    });
  };
  
  return { prefetchOrgOverview, prefetchAudience };
}

