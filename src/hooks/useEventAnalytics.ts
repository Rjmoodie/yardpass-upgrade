// Event analytics hooks with edge function integration and stale-while-revalidate
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const numberOrZero = (val: any): number => (typeof val === 'number' && !isNaN(val)) ? val : 0;

export interface EventAnalytics {
  counters: {
    views_total: number;
    views_unique: number;
    completions: number;
    avg_dwell_ms: number;
    clicks_tickets: number;
    clicks_details: number;
    clicks_organizer: number;
    clicks_share: number;
    clicks_comment: number;
    likes: number;
    comments: number;
    shares: number;
  };
  timeSeries: Array<{
    d: string;
    views_total: number;
    views_unique: number;
    completions: number;
    avg_dwell_ms: number;
    clicks_tickets: number;
    clicks_details: number;
    clicks_organizer: number;
    clicks_share: number;
    clicks_comment: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
}

export interface TopPostsAnalytics {
  posts: Array<{
    post_id: string;
    title?: string;
    media_urls: string[];
    views_total: number;
    views_unique: number;
    completions: number;
    clicks_tickets: number;
    clicks_total: number;
    engagement_total: number;
    ctr_tickets: number;
    created_at: string;
  }>;
}

export function useEventAnalytics(eventId: string) {
  const [analytics, setAnalytics] = useState<{
    counters: {
      views_unique: number;
      views_total: number;
      completions: number;
      avg_dwell_ms: number;
      clicks_tickets: number;
      clicks_share: number;
      clicks_comment: number;
      likes: number;
      comments: number;
      shares: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController>();
  const lastSuccessfulDataRef = useRef<typeof analytics>(null);

  const refetch = useCallback(async (params?: { from?: string; to?: string }) => {
    if (!eventId) return;

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    // Show stale data immediately if available
    if (lastSuccessfulDataRef.current) {
      setAnalytics(lastSuccessfulDataRef.current);
    }

    try {
      const { data, error: fetchError } = await supabase.functions.invoke('analytics-event-overview', {
        body: { 
          event_id: eventId, 
          from: params?.from, 
          to: params?.to 
        }
      });

      if (fetchError) {
        throw fetchError;
      }

      const normalized = {
        counters: {
          views_unique: numberOrZero(data?.counters?.views_unique),
          views_total: numberOrZero(data?.counters?.views_total),
          completions: numberOrZero(data?.counters?.completions),
          avg_dwell_ms: numberOrZero(data?.counters?.avg_dwell_ms),
          clicks_tickets: numberOrZero(data?.counters?.clicks_tickets),
          clicks_share: numberOrZero(data?.counters?.clicks_share),
          clicks_comment: numberOrZero(data?.counters?.clicks_comment),
          likes: numberOrZero(data?.counters?.likes),
          comments: numberOrZero(data?.counters?.comments),
          shares: numberOrZero(data?.counters?.shares)
        }
      };

      setAnalytics(normalized);
      lastSuccessfulDataRef.current = normalized;
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch event analytics:', err);
      setError(err.message || 'Failed to fetch analytics');
      
      // Keep showing stale data on error
      if (!lastSuccessfulDataRef.current) {
        setAnalytics(null);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    analytics,
    loading,
    error,
    refetch
  };
}

export function useTopPostsAnalytics(eventId: string) {
  const [topPosts, setTopPosts] = useState<{
    posts: Array<{
      post_id: string;
      title?: string | null;
      media_urls?: string[] | null;
      created_at: string;
      views_unique?: number;
      views_total?: number;
      completions?: number;
      clicks_tickets?: number;
      engagement_total?: number;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController>();
  const lastSuccessfulDataRef = useRef<typeof topPosts>(null);

  const refetch = useCallback(async (params?: { from?: string; to?: string; limit?: number }) => {
    if (!eventId) return;

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    // Show stale data immediately if available
    if (lastSuccessfulDataRef.current) {
      setTopPosts(lastSuccessfulDataRef.current);
    }

    try {
      const { data, error: fetchError } = await supabase.functions.invoke('analytics-top-posts', {
        body: { 
          event_id: eventId,
          from: params?.from,
          to: params?.to,
          limit: params?.limit || 10
        }
      });

      if (fetchError) {
        throw fetchError;
      }

      const normalized = {
        posts: (data?.posts || []).map((post: any) => ({
          post_id: post.post_id,
          title: post.title || null,
          media_urls: post.media_urls || [],
          created_at: post.created_at,
          views_unique: numberOrZero(post.views_unique),
          views_total: numberOrZero(post.views_total),
          completions: numberOrZero(post.completions),
          clicks_tickets: numberOrZero(post.clicks_tickets),
          engagement_total: numberOrZero(post.engagement_total)
        }))
      };

      setTopPosts(normalized);
      lastSuccessfulDataRef.current = normalized;
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch top posts analytics:', err);
      setError(err.message || 'Failed to fetch top posts analytics');
      
      // Keep showing stale data on error
      if (!lastSuccessfulDataRef.current) {
        setTopPosts(null);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    topPosts,
    loading,
    error,
    refetch
  };
}
