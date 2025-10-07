import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type EventPost = {
  id: string;
  event_id: string;
  text: string;
  media_urls: string[];
  like_count: number;
  comment_count: number;
  author_user_id: string;
  created_at: string;
  author_display_name: string;
  author_is_organizer: boolean;
  liked_by_me: boolean;
};

type Page = { items: EventPost[]; nextCursor?: { cursorTs: string; cursorId: string } };

async function fetchEventPostsPage(
  eventId: string, 
  cursor?: { cursorTs: string; cursorId: string }
): Promise<Page> {
  const { cursorTs, cursorId, limit = 30 } = cursor || {};
  
  // Call the new RPC function for event posts
  const { data: items, error } = await supabase.rpc('get_event_posts_cursor_v2', {
    in_event_id: eventId,
    in_limit: limit,
    in_cursor_ts: cursorTs || null,
    in_cursor_id: cursorId || null,
  });
  
  if (error) throw new Error(`RPC error: ${error.message}`);
  
  // Create next cursor
  const next = items?.length ? { 
    cursorTs: items.at(-1)!.created_at, 
    cursorId: items.at(-1)!.id 
  } : null;
  
  return { items: items || [], nextCursor: next };
}

export function useEventPostsInfinite(eventId: string, userId?: string) {
  const qc = useQueryClient();
  const q = useInfiniteQuery<Page, Error>({
    queryKey: ['eventPosts', eventId, userId],
    queryFn: ({ pageParam }) => fetchEventPostsPage(eventId, pageParam as { cursorTs: string; cursorId: string } | undefined),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
    enabled: !!eventId, // Only run when eventId is provided
  });

  // Targeted realtime updates for engagement
  function applyEngagementDelta(postId: string, delta: Partial<Record<'like_count' | 'comment_count', number>>) {
    qc.setQueryData(['eventPosts', eventId, userId], (data: any) => {
      if (!data) return data;
      for (const page of data.pages) {
        const idx = page.items.findIndex((x: any) => x.id === postId);
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
