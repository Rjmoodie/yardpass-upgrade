import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FeedItem =
  | {
      item_type: 'event';
      sort_ts: string;
      item_id: string;
      event_id: string;
      event_title: string;
      event_description: string;
      event_starts_at: string | null;
      event_cover_image: string;
      event_organizer: string;
      event_organizer_id: string;
      event_location: string;
      author_id: null;
      author_name: null;
      author_badge: null;
      media_urls: null;
      content: null;
      metrics: Record<string, any>;
    }
  | {
      item_type: 'post';
      sort_ts: string;
      item_id: string;
      event_id: string;
      event_title: string;
      event_description: string;
      event_starts_at: string | null;
      event_cover_image: string;
      event_organizer: string;
      event_organizer_id: string;
      event_location: string;
      author_id: string | null;
      author_name: string | null;
      author_badge: string | null;
      media_urls: string[] | null;
      content: string | null;
      metrics: Record<string, any>;
    };

type Page = { items: FeedItem[]; nextCursor: { ts: string; id: string } | null };

export function useUnifiedFeed(userId?: string) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const items = pages.flatMap(p => p.items);

  const fetchPage = useCallback(async (cursor?: { ts: string; id: string }) => {
    setLoading(true);
    setError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const { data, error } = await supabase.rpc('get_home_feed_v2', {
        p_user: userId || null,
        p_limit: 20,
        p_cursor_ts: cursor?.ts ?? null,
        p_cursor_id: cursor?.id ?? null,
      });

      if (error) throw error;

      const newItems: FeedItem[] = (data ?? []) as any[];
      
      // De-dupe by composite key type+id to avoid "override"
      setPages(prev => {
        const existingItems = prev.flatMap(p => p.items);
        const seen = new Set(existingItems.map(i => `${i.item_type}:${i.item_id}`));
        const dedupedItems = newItems.filter(it => {
          const key = `${it.item_type}:${it.item_id}`;
          return !seen.has(key);
        });

        const last = newItems[newItems.length - 1];
        return [
          ...prev,
          {
            items: dedupedItems,
            nextCursor: last ? { ts: last.sort_ts, id: last.item_id } : null,
          },
        ];
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message || 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadMore = useCallback(async () => {
    const lastPage = pages[pages.length - 1];
    await fetchPage(lastPage?.nextCursor ?? undefined);
  }, [pages, fetchPage]);

  const reset = useCallback(() => setPages([]), []);

  const prependItem = useCallback((newItem: FeedItem) => {
    setPages(prev => {
      const key = `${newItem.item_type}:${newItem.item_id}`;
      const seen = new Set(prev.flatMap(p => p.items.map(i => `${i.item_type}:${i.item_id}`)));
      
      if (seen.has(key)) return prev; // already present

      // Prepend to first page while keeping pagination intact
      const [first, ...rest] = prev.length ? prev : [{ items: [], nextCursor: null }];
      return [{ ...first, items: [newItem, ...first.items] }, ...rest];
    });
  }, []);

  useEffect(() => {
    // initial load on user change
    setPages([]);
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { 
    items, 
    loading, 
    error, 
    loadMore, 
    reset, 
    prependItem,
    hasMore: !!pages[pages.length - 1]?.nextCursor 
  };
}
