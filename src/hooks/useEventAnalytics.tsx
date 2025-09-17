import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  const [analytics, setAnalytics] = useState<EventAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async (from?: string, to?: string) => {
    if (!eventId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({ event_id: eventId });
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      
      const { data, error: fetchError } = await supabase.functions.invoke('analytics-event-overview', {
        body: { event_id: eventId, from, to }
      });

      if (fetchError) {
        throw fetchError;
      }

      setAnalytics(data);
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [eventId]);

  return {
    analytics,
    loading,
    error,
    refetch: fetchAnalytics
  };
}

export function useTopPostsAnalytics(eventId: string) {
  const [topPosts, setTopPosts] = useState<TopPostsAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTopPosts = async (metric: 'views' | 'ctr' | 'engagement' = 'views', limit = 10) => {
    if (!eventId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase.rpc('get_top_posts_analytics', {
        p_event_id: eventId,
        p_metric: metric,
        p_limit: limit
      });

      if (fetchError) {
        throw fetchError;
      }

      setTopPosts(data);
    } catch (err: any) {
      console.error('Failed to fetch top posts:', err);
      setError(err.message || 'Failed to fetch top posts analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopPosts();
  }, [eventId]);

  return {
    topPosts,
    loading,
    error,
    refetch: fetchTopPosts
  };
}