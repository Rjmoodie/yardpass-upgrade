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
      event_owner_context_type: string;
      event_location: string;
      author_id: null;
      author_name: null;
      author_badge: null;
      media_urls: null;
      content: null;
      metrics: Record<string, any>;
      sponsor?: {
        name: string;
        logo_url?: string;
        tier: string;
        amount_cents: number;
      } | null;
      sponsors?: Array<{
        name: string;
        logo_url?: string;
        tier: string;
        amount_cents: number;
      }> | null;
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
      event_owner_context_type: string;
      event_location: string;
      author_id: string | null;
      author_name: string | null;
      author_badge: string | null;
      author_social_links: any[] | null;
      media_urls: string[] | null;
      content: string | null;
      metrics: Record<string, any>;
      sponsor?: null;
      sponsors?: null;
    };

type Page = { items: FeedItem[]; nextCursor: { ts: string; id: string } | null };

export function useUnifiedFeed(userId?: string) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const items = pages.flatMap(p => p.items);
  
  // Helper for composite key generation
  const keyOf = (item: FeedItem) => `${item.item_type}:${item.item_id}`;

  const fetchPage = useCallback(async (cursor?: { ts: string; id: string }) => {
    setLoading(true);
    setError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      console.log('🚀 Starting feed fetch with params:', { userId, cursor });
      
      const { data, error } = await supabase.rpc('get_home_feed', {
        p_user_id: userId || null,
        p_limit: 20,
        p_offset: 0, // For now, we'll use the existing function and adapt pagination later
      });

      console.log('📊 RPC Response:', { error, dataExists: !!data, dataType: typeof data, dataLength: Array.isArray(data) ? data.length : 'not array' });

      if (error) {
        console.error('❌ RPC Error:', error);
        throw error;
      }

      console.log('🔍 Feed data received:', { data, dataType: typeof data, dataLength: data?.length });
      
      // Transform home_feed_row data to unified feed structure
      const transformedItems: FeedItem[] = [];
      
      (data ?? []).forEach((row: any) => {
        // Create event item
        const eventItem: FeedItem = {
          item_type: 'event',
          sort_ts: row.start_at || new Date().toISOString(),
          item_id: row.event_id,
          event_id: row.event_id,
          event_title: row.title || 'Untitled Event',
          event_description: row.description || '',
          event_starts_at: row.start_at,
          event_cover_image: row.cover_image_url || '',
          event_organizer: row.organizer_display_name || 'Unknown Organizer',
          event_organizer_id: row.created_by || '',
          event_owner_context_type: 'individual',
          event_location: row.city || row.venue || 'TBA',
          author_id: null,
          author_name: null,
          author_badge: null,
          media_urls: null,
          content: null,
          metrics: { likes: 0, comments: 0 },
          sponsor: null,
          sponsors: null
        };

        transformedItems.push(eventItem);

        // Add posts from this event
        if (row.recent_posts && Array.isArray(row.recent_posts)) {
          console.log('🎬 Processing posts for event:', row.event_id, 'Posts:', row.recent_posts.length);
          row.recent_posts.forEach((post: any, postIndex: number) => {
            console.log(`🎬 Post ${postIndex}:`, { 
              id: post.id, 
              media_urls: post.media_urls, 
              text: post.text?.substring(0, 50) 
            });
            const postItem: FeedItem = {
              item_type: 'post',
              sort_ts: post.created_at || new Date().toISOString(),
              item_id: post.id,
              event_id: row.event_id,
              event_title: row.title || 'Untitled Event',
              event_description: row.description || '',
              event_starts_at: row.start_at,
              event_cover_image: row.cover_image_url || '',
              event_organizer: row.organizer_display_name || 'Unknown Organizer',
              event_organizer_id: row.created_by || '',
              event_owner_context_type: 'individual',
              event_location: row.city || row.venue || 'TBA',
              author_id: post.author?.id || null,
              author_name: post.author?.display_name || null,
              author_badge: post.author?.badge_label || null,
              author_social_links: null,
              media_urls: post.media_urls || null,
              content: post.text || null,
              metrics: { 
                likes: post.like_count || 0, 
                comments: post.comment_count || 0 
              },
              sponsor: null,
              sponsors: null
            };
            transformedItems.push(postItem);
          });
        }
      });

      // Sort by timestamp descending
      const newItems = transformedItems.sort((a, b) => 
        new Date(b.sort_ts).getTime() - new Date(a.sort_ts).getTime()
      );
      
      console.log('🔍 newItems processed:', { newItemsLength: newItems.length, firstItem: newItems[0] });
      
      // De-dupe within this batch only, not against all existing items
      setPages(prev => {
        const batchSeen = new Set<string>();
        const dedupedItems = newItems.filter(it => {
          const key = keyOf(it);
          if (batchSeen.has(key)) {
            return false; // Skip duplicates within this batch
          }
          batchSeen.add(key);
          return true;
        });

        console.log('🔍 dedupedItems:', { 
          originalLength: newItems.length,
          dedupedLength: dedupedItems.length, 
          totalPages: prev.length + 1,
          removedDuplicates: newItems.length - dedupedItems.length
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

  const refresh = useCallback(() => {
    setPages([]);
    fetchPage();
  }, [fetchPage]);

  const prependItem = useCallback((newItem: FeedItem) => {
    setPages(prev => {
      const key = keyOf(newItem);
      const seen = new Set(prev.flatMap(p => p.items.map(keyOf)));
      
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
    refresh, 
    prependItem,
    hasMore: !!pages[pages.length - 1]?.nextCursor 
  };
}
