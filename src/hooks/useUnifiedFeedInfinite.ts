import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

type UnifiedItemEvent = { kind: 'event'; id: string; created_at: string; /* ... */ };
type UnifiedItemPost  = { kind: 'post';  id: string; created_at: string; /* ... */ };
export type UnifiedItem = UnifiedItemEvent | UnifiedItemPost;

type Page = { items: UnifiedItem[]; nextCursor?: string };

async function fetchUnifiedPage(cursor?: string): Promise<Page> {
  // Backward compatible: your edge function can ignore cursor if not implemented yet
  const res = await fetch(`/functions/v1/home-feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error('Unified feed fetch failed');
  return res.json();
}

export function useUnifiedFeedInfinite() {
  const qc = useQueryClient();
  const q = useInfiniteQuery<Page, Error>({
    queryKey: ['unifiedFeed'],
    queryFn: ({ pageParam }) => fetchUnifiedPage(pageParam as string | undefined),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });

  // Example: targeted realtime updates can call this updater
  function applyEngagementDelta(postId: string, delta: Partial<Record<'like_count' | 'comment_count', number>>) {
    qc.setQueryData(['unifiedFeed'], (data: any) => {
      if (!data) return data;
      for (const page of data.pages) {
        const idx = page.items.findIndex((x: any) => x.id === postId && x.kind === 'post');
        if (idx >= 0) {
          page.items[idx] = { ...page.items[idx], ...Object.fromEntries(
            Object.entries(delta).map(([k, v]) => [k, ((page.items[idx] as any)[k] ?? 0) + (v ?? 0)])
          ) };
          break;
        }
      }
      return { ...data };
    });
  }

  const items = q.data?.pages.flatMap(p => p.items) ?? [];
  return {
    ...q,
    items,
    applyEngagementDelta,
  };
}
