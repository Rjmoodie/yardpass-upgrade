import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FeedCursor, FeedItem, FeedPage } from './unifiedFeedTypes';

type EngagementDelta = {
  like_count?: number;
  comment_count?: number;
  viewer_has_liked?: boolean;
  mode?: 'delta' | 'absolute';
};

async function fetchPage(
  cursor: FeedCursor | undefined,
  limit: number,
  accessToken: string | null
): Promise<FeedPage> {
  const invokeOptions: {
    body: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {
    body: {
      limit,
      cursor: cursor
        ? {
            ts: cursor.cursorTs,
            id: cursor.cursorId,
            score: cursor.cursorScore ?? null,
          }
        : null,
    },
  };

  if (accessToken) {
    invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };
  }

  const { data, error } = await supabase.functions.invoke('home-feed', invokeOptions);

  if (error) {
    throw new Error(`home-feed failed: ${error.message}`);
  }

  if (!data || typeof data !== 'object' || !Array.isArray((data as any).items)) {
    throw new Error('home-feed returned an unexpected payload');
  }

  // 🔍 Debug: Log what home-feed is returning
  const feedData = data as FeedPage;
  const posts = feedData.items.filter(i => i.item_type === 'post');
  console.log('🔍 home-feed Edge Function returned:', {
    totalItems: feedData.items.length,
    totalPosts: posts.length,
    postSamples: posts.slice(0, 3).map(p => ({
      id: p.item_id,
      rawMetrics: p.metrics,
      likes: p.metrics?.likes,
      comments: p.metrics?.comments,
      hasMetrics: !!p.metrics
    }))
  });

  return data as FeedPage;
}

export function useUnifiedFeedInfinite(limit = 30) {
  const qc = useQueryClient();

  const query = useInfiniteQuery<FeedPage, Error>({
    queryKey: ['unifiedFeed', { limit }],
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const cursor = pageParam as FeedCursor | undefined;
      return fetchPage(cursor, limit, session?.access_token ?? null);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 15_000,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  function applyEngagementDelta(postId: string, delta: EngagementDelta) {
    qc.setQueryData(['unifiedFeed', { limit }], (oldData: any) => {
      if (!oldData) return oldData;

      const pages = oldData.pages.map((page: FeedPage) => {
        const updatedItems = page.items.map((item) => {
          if (item.item_type !== 'post' || item.item_id !== postId) return item;

          const mode = delta.mode ?? 'delta';
          const currentLikes = item.metrics.likes ?? 0;
          const currentComments = item.metrics.comments ?? 0;

          const likes = delta.like_count != null
            ? Math.max(0, mode === 'absolute' ? delta.like_count : currentLikes + delta.like_count)
            : currentLikes;

          const comments = delta.comment_count != null
            ? Math.max(0, mode === 'absolute' ? delta.comment_count : currentComments + delta.comment_count)
            : currentComments;

          return {
            ...item,
            metrics: {
              ...item.metrics,
              likes,
              comments,
              viewer_has_liked: delta.viewer_has_liked ?? item.metrics.viewer_has_liked,
            },
          } as FeedItem;
        });

        return { ...page, items: updatedItems };
      });

      return { ...oldData, pages };
    });
  }

  return { ...query, items, applyEngagementDelta };
}
