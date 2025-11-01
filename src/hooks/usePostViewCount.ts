import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ViewCount {
  postId: string;
  views: number;
  uniqueViews: number;
}

/**
 * Fetch view counts for a batch of posts
 */
export function usePostViewCounts(postIds: string[]) {
  const [viewCounts, setViewCounts] = useState<Map<string, ViewCount>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postIds || postIds.length === 0) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchViewCounts() {
      try {
        // Query aggregated view counts for these posts
        const { data, error } = await supabase
          .rpc('get_post_view_counts', { p_post_ids: postIds });

        if (!isMounted) return;

        if (error) {
          console.error('[usePostViewCounts] Error fetching view counts:', error);
          setViewCounts(new Map());
        } else if (data && Array.isArray(data)) {
          const map = new Map(
            data.map((row: any) => [
              row.post_id,
              {
                postId: row.post_id,
                views: row.view_count || 0,
                uniqueViews: row.unique_sessions || 0,
              },
            ])
          );
          setViewCounts(map);
        }
      } catch (err) {
        console.error('[usePostViewCounts] Unexpected error:', err);
        setViewCounts(new Map());
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchViewCounts();

    return () => {
      isMounted = false;
    };
  }, [postIds.join(',')]); // Re-fetch when post IDs change

  return { viewCounts, loading };
}

/**
 * Fetch view count for a single post
 */
export function usePostViewCount(postId: string | null) {
  const [viewCount, setViewCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchCount() {
      try {
        const { count, error } = await supabase
          .from('post_impressions')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId);

        if (!isMounted) return;

        if (error) {
          console.error('[usePostViewCount] Error:', error);
          setViewCount(0);
        } else {
          setViewCount(count || 0);
        }
      } catch (err) {
        console.error('[usePostViewCount] Unexpected error:', err);
        setViewCount(0);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchCount();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  return { viewCount, loading };
}

