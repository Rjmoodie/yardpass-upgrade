import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MuxVideoMetrics {
  total_plays: number;
  unique_viewers: number;
  avg_watch_time: number;
  completion_rate: number;
  videos: Array<{
    asset_id: string;
    plays: number;
    unique_viewers: number;
    avg_watch_time: number;
    completion_rate: number;
  }>;
}

export function useMuxAnalytics(eventId: string, fromDate?: string, toDate?: string) {
  const [metrics, setMetrics] = useState<MuxVideoMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMuxAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get all posts with video media for this event
      const { data: posts, error: postsError } = await supabase
        .from('events.event_posts')
        .select('media_urls')
        .eq('event_id', eventId)
        .not('media_urls', 'is', null);

      if (postsError) throw postsError;

      // Extract Mux playback IDs from media URLs
      const playbackIds: string[] = [];
      posts?.forEach(post => {
        post.media_urls?.forEach((url: string) => {
          if (url.startsWith('mux:')) {
            const id = url.replace('mux:', '');
            playbackIds.push(id);
          }
        });
      });

      if (playbackIds.length === 0) {
        setMetrics({
          total_plays: 0,
          unique_viewers: 0,
          avg_watch_time: 0,
          completion_rate: 0,
          videos: []
        });
        setLoading(false);
        return;
      }

      // Call Mux analytics edge function
      const { data, error: funcError } = await supabase.functions.invoke('analytics-video-mux', {
        body: {
          asset_ids: playbackIds,
          from_date: fromDate,
          to_date: toDate
        }
      });

      if (funcError) throw funcError;

      setMetrics(data);
    } catch (err: any) {
      console.error('Error fetching Mux analytics:', err);
      setError(err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMuxAnalytics();
  }, [eventId, fromDate, toDate]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMuxAnalytics
  };
}
