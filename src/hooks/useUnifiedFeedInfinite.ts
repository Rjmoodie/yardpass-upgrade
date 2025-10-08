import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FeedCursor, FeedItem, FeedPage } from './unifiedFeedTypes';

async function fetchPage(cursor: FeedCursor | undefined, limit: number, accessToken: string | null): Promise<FeedPage> {
  const { data, error } = await supabase.functions.invoke('home-feed', {
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
  });

  if (error) {
    throw new Error(`home-feed failed: ${error.message}`);
  }

  return data;
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

  function applyEngagementDelta(postId: string, delta: Partial<Record<'like_count' | 'comment_count', number>>) {
    qc.setQueryData(['unifiedFeed', { limit }], (oldData: any) => {
      if (!oldData) return oldData;

      const pages = oldData.pages.map((page: FeedPage) => {
        const updatedItems = page.items.map((item) => {
          if (item.item_type !== 'post' || item.item_id !== postId) return item;

          const likes = delta.like_count != null
            ? Math.max(0, (item.metrics.likes ?? 0) + delta.like_count)
            : item.metrics.likes ?? 0;

          const comments = delta.comment_count != null
            ? Math.max(0, (item.metrics.comments ?? 0) + delta.comment_count)
            : item.metrics.comments ?? 0;

          return {
            ...item,
            metrics: {
              ...item.metrics,
              likes,
              comments,
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
