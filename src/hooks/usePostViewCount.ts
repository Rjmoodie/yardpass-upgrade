import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ViewCount {
  postId: string;
  views: number;
  uniqueViews: number;
}

/**
 * Fetch view counts for a batch of posts
 * ✅ Optimized with debouncing to reduce DB queries
 */
export function usePostViewCounts(postIds: string[]) {
  const [viewCounts, setViewCounts] = useState<Map<string, ViewCount>>(new Map());
  const [loading, setLoading] = useState(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!postIds || postIds.length === 0) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce: Wait 300ms before fetching (reduces rapid-fire queries during scroll)
    debounceTimerRef.current = setTimeout(() => {
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
    }, 300); // 300ms debounce

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [postIds.join(',')]); // Re-fetch when post IDs change

  return { viewCounts, loading };
}

/**
 * Fetch view count for a single post
 * ✅ Optimized with debouncing to reduce DB queries
 */
export function usePostViewCount(postId: string | null) {
  const [viewCount, setViewCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce: Wait 300ms before fetching
    debounceTimerRef.current = setTimeout(() => {
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
    }, 300); // 300ms debounce

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [postId]);

  return { viewCount, loading };
}

