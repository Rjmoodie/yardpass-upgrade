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
  cursor?: { cursorTs: string; cursorId: string; limit?: number }
): Promise<Page> {
  const limit = cursor?.limit || 30;
  const cursorTs = cursor?.cursorTs;
  const cursorId = cursor?.cursorId;
  
  // Fallback to direct query since RPC doesn't exist
  const query = supabase
    .from('event_posts')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (cursorTs && cursorId) {
    query.lt('created_at', cursorTs);
  }
  
  const { data: items, error } = await query;
  
  if (error) throw new Error(`Query error: ${error.message}`);
  
  const itemsArray = (items || []) as unknown as EventPost[];
  
  // Create next cursor
  const next = itemsArray.length ? { 
    cursorTs: itemsArray[itemsArray.length - 1].created_at, 
    cursorId: itemsArray[itemsArray.length - 1].id,
    limit
  } : null;
  
  return { items: itemsArray, nextCursor: next };
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
