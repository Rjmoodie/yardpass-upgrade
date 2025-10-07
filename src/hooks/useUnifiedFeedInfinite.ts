import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

export type UnifiedEvent = {
  kind: 'event';
  id: string;
  created_at: string;
  event: {
    id: string;
    title: string;
    cover_image_url: string | null;
    start_at: string;
    end_at: string;
    city: string | null;
    created_at: string;
  };
};

export type UnifiedPost = {
  kind: 'post';
  id: string;
  created_at: string;
  post: {
    id: string;
    event_id: string;
    author_user_id: string;
    text: string | null;
    media_urls: string[] | null;
    created_at: string;
    like_count: number;
    comment_count: number;
    author_display_name: string;
    author_photo_url: string | null;
  };
};

export type UnifiedItem = UnifiedEvent | UnifiedPost;

type Page = {
  items: UnifiedItem[];
  nextCursor: { cursorTs: string; cursorId: string } | null;
};

async function fetchPage(cursor?: { cursorTs: string; cursorId: string }, limit = 30): Promise<Page> {
  const res = await fetch('/functions/v1/home-feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // forward cookies for Supabase Auth helpers, if used
    body: JSON.stringify({
      limit,
      cursorTs: cursor?.cursorTs,
      cursorId: cursor?.cursorId,
    }),
  });
  if (!res.ok) {
    const e = await res.text().catch(() => '');
    throw new Error(`home-feed failed: ${res.status} ${e}`);
  }
  return res.json();
}

export function useUnifiedFeedInfinite(limit = 30) {
  const qc = useQueryClient();

  const q = useInfiniteQuery<Page, Error>({
    queryKey: ['unifiedFeed', { limit }],
    queryFn: ({ pageParam }) => fetchPage(pageParam as any, limit),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  // For realtime/optimistic updates
  function applyEngagementDelta(postId: string, delta: Partial<Record<'like_count' | 'comment_count', number>>) {
    qc.setQueryData(['unifiedFeed', { limit }], (oldData: any) => {
      if (!oldData) return oldData;
      const pages = oldData.pages.map((page: Page) => {
        const updatedItems = page.items.map((it) => {
          if (it.kind !== 'post' || it.id !== postId) return it;
          const post = { ...it.post };
          if (delta.like_count != null) post.like_count = Math.max(0, (post.like_count ?? 0) + delta.like_count);
          if (delta.comment_count != null) post.comment_count = Math.max(0, (post.comment_count ?? 0) + delta.comment_count);
          return { ...it, post };
        });
        return { ...page, items: updatedItems };
      });
      return { ...oldData, pages };
    });
  }

  return { ...q, items, applyEngagementDelta };
}