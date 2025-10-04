// src/hooks/useUnifiedFeed.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SMART_FEED_ENABLED = true; // Enabled to use smart edge function with full pagination
const PAGE_SIZE = 40;

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
      metrics: {
        likes: number;
        comments: number;
        viewer_has_liked?: boolean;
        [k: string]: any;
      };
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
      metrics: {
        likes: number;
        comments: number;
        viewer_has_liked?: boolean; // ← canonical client flag
        [k: string]: any;
      };
      sponsor?: null;
      sponsors?: null;
    };

type Page = { items: FeedItem[]; nextCursor: { ts: string; id: string } | null };

export function useUnifiedFeed(userId?: string) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const items = pages.flatMap(p => p.items);
  const keyOf = (item: FeedItem) => `${item.item_type}:${item.item_id}`;

  // ---------- Helpers ----------

  // Helper to fetch viewer_has_liked status for posts
  const enrichWithLikeStatus = useCallback(async (items: FeedItem[]): Promise<FeedItem[]> => {
    if (!userId) {
      // Not authenticated, so viewer_has_liked is always false
      return items.map((it: FeedItem) => {
        if (it.item_type === 'event') return it;
        return {
          ...it,
          metrics: {
            ...it.metrics,
            viewer_has_liked: false,
          }
        };
      });
    }

    // Get all post IDs that need like status
    const postIds = items
      .filter((it: FeedItem) => it.item_type === 'post' && it.item_id) // Filter out undefined/null IDs
      .map((it: FeedItem) => it.item_id);

    if (postIds.length === 0) return items;

    // Fetch like status for all posts in one query
    const { data: userLikes } = await supabase
      .from('event_reactions')
      .select('post_id')
      .in('post_id', postIds)
      .eq('user_id', userId)
      .eq('kind', 'like');

    const likedPostIds = new Set(userLikes?.map(like => like.post_id) || []);

    // Update items with correct viewer_has_liked status
    return items.map((it: FeedItem) => {
      if (it.item_type === 'event') return it;
      return {
        ...it,
        metrics: {
          ...it.metrics,
          viewer_has_liked: likedPostIds.has(it.item_id),
        }
      };
    });
  }, [userId]);

  // Map get_home_feed_ids → full FeedItem (RPC fallback path)
  const mapIdsToItems = useCallback(async (rows: any[]): Promise<FeedItem[]> => {
    if (!rows?.length) return [];

    const eventIds = Array.from(new Set(rows.map(r => r.event_id)));
    const postIds = rows.filter(r => r.item_type === 'post').map(r => r.item_id);

    // Events (+ organizer name)
    const { data: events } = await supabase
      .from('events')
      .select(`
        id, title, description, cover_image_url, start_at, venue, city, created_by,
        owner_context_type, owner_context_id,
        user_profiles!events_created_by_fkey(display_name),
        organizations!events_owner_context_id_fkey(name)
      `)
      .in('id', eventIds);

    const eMap = new Map<string, any>();
    (events ?? []).forEach(e => eMap.set(e.id, e));

    // Posts (+ viewer_has_liked via view)
    const { data: posts } = postIds.length
      ? await supabase
          .from('event_posts_with_meta')
          .select('*')
          .in('id', postIds)
      : { data: [] as any[] };

    const pMap = new Map<string, any>();
    (posts ?? []).forEach(p => pMap.set(p.id, p));

    const out: FeedItem[] = [];
    rows.forEach(row => {
      const ev = eMap.get(row.event_id);
      const userOrganizer = ev?.user_profiles;
      const orgOrganizer = ev?.organizations;
      
      // Choose organizer name based on context type
      const organizerName = ev?.owner_context_type === 'organization' && orgOrganizer?.name
        ? orgOrganizer.name
        : userOrganizer?.display_name ?? 'Organizer';

      if (row.item_type === 'event') {
        out.push({
          item_type: 'event',
          sort_ts: ev?.start_at || new Date().toISOString(),
          item_id: row.item_id,
          event_id: row.event_id,
          event_title: ev?.title ?? 'Event',
          event_description: ev?.description ?? '',
          event_starts_at: ev?.start_at ?? null,
          event_cover_image: ev?.cover_image_url ?? '',
          event_organizer: organizerName,
          event_organizer_id: ev?.owner_context_type === 'organization' ? ev?.owner_context_id ?? '' : ev?.created_by ?? '',
          event_owner_context_type: ev?.owner_context_type ?? 'individual',
          event_location: [ev?.venue, ev?.city].filter(Boolean).join(', ') || 'TBA',
          author_id: null,
          author_name: null,
          author_badge: null,
          media_urls: null,
          content: null,
          metrics: { likes: 0, comments: 0 },
          sponsor: null,
          sponsors: null,
        });
      } else {
        const po = pMap.get(row.item_id);
        out.push({
          item_type: 'post',
          sort_ts: po?.created_at || new Date().toISOString(),
          item_id: row.item_id,
          event_id: row.event_id,
          event_title: ev?.title ?? 'Event',
          event_description: ev?.description ?? '',
          event_starts_at: ev?.start_at ?? null,
          event_cover_image: ev?.cover_image_url ?? '',
          event_organizer: organizerName,
          event_organizer_id: ev?.owner_context_type === 'organization' ? ev?.owner_context_id ?? '' : ev?.created_by ?? '',
          event_owner_context_type: ev?.owner_context_type ?? 'individual',
          event_location: [ev?.venue, ev?.city].filter(Boolean).join(', ') || 'TBA',
          author_id: po?.author_user_id ?? null,
          author_name: po?.author_name ?? null,
          author_badge: po?.author_badge_label ?? null,
          author_social_links: null,
          media_urls: po?.media_urls ?? null,
          content: po?.text ?? null,
          metrics: {
            likes: po?.like_count ?? 0,
            comments: po?.comment_count ?? 0,
            viewer_has_liked: Boolean(po?.viewer_has_liked), // ← from view
          },
          sponsor: null,
          sponsors: null,
        });
      }
    });

    // Enrich with proper like status
    return await enrichWithLikeStatus(out);
  }, []);

  // ---------- Fetchers ----------

  // SMART (Edge Function) — expects posts to include viewer_has_liked for the JWT user
  const fetchSmart = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('home-feed', {
      body: {
        user_id: userId ?? null,
        limit: PAGE_SIZE,
        offset: offsetRef.current,
        mode: 'smart',
      },
    });
    if (error) throw error;

    const items = (data as any)?.items ?? [];

    const transformed: (FeedItem | null)[] = (items ?? []).map((it: any) => {
      const itemType = it.item_type;
      // Fallbacks for inconsistent shapes coming from edge/RPC
      const postId = it.item_id || it.post_id || it.id || null;
      const eventId = it.event_id || it.parent_event_id || (itemType === 'event' ? (it.id || it.item_id) : null);
      const createdTs = it.created_at || it.sort_ts || new Date().toISOString();
      const startsTs = it.event_starts_at || it.start_at || null;
      const mediaRaw = Array.isArray(it.media_urls)
        ? it.media_urls
        : (typeof it.media_urls === 'string' && it.media_urls)
          ? [it.media_urls]
          : null;
      const media = (Array.isArray(mediaRaw) && mediaRaw.length > 0) ? mediaRaw : null;

      // Guard against malformed rows from backends
      if (itemType === 'event') {
        if (!eventId) return null;
        return {
          item_type: 'event',
          sort_ts: startsTs || createdTs,
          item_id: eventId || '',
          event_id: eventId || '',
          event_title: it.event_title || it.title || 'Event',
          event_description: it.event_description || it.description || '',
          event_starts_at: startsTs,
          event_cover_image: it.event_cover_image || it.cover_image_url || '',
          event_organizer: it.event_organizer || 'Organizer',
          event_organizer_id: it.event_organizer_id || '',
          event_owner_context_type: it.event_owner_context_type || 'individual',
          event_location: it.event_location || [it.venue, it.city].filter(Boolean).join(', ') || 'TBA',
          author_id: null,
          author_name: null,
          author_badge: null,
          media_urls: null,
          content: null,
          metrics: { likes: 0, comments: 0 },
          sponsor: null,
          sponsors: null,
        } as FeedItem;
      }

      // Default to post
      if (!postId) return null; // do not surface invalid posts
      return {
        item_type: 'post',
        sort_ts: createdTs,
        item_id: postId,
        event_id: eventId || it.event_id || '',
        event_title: it.event_title || it.title || 'Event',
        event_description: it.event_description || it.description || '',
        event_starts_at: startsTs,
        event_cover_image: it.event_cover_image || it.cover_image_url || '',
        event_organizer: it.event_organizer || 'Organizer',
        event_organizer_id: it.event_organizer_id || '',
        event_owner_context_type: it.event_owner_context_type || 'individual',
        event_location: it.event_location || [it.venue, it.city].filter(Boolean).join(', ') || 'TBA',
        author_id: it.author_user_id || it.author_id || null,
        author_name: it.author_name || null,
        author_badge: null,
        author_social_links: null,
        media_urls: media,
        content: (typeof it.content === 'string' ? it.content.trim() : (typeof it.text === 'string' ? it.text.trim() : null)) || null,
        metrics: {
          likes: it.like_count || it.metrics?.likes || 0,
          comments: it.comment_count || it.metrics?.comments || 0,
          // IMPORTANT: keep this exact name so the UI reads the correct initial state
          viewer_has_liked: Boolean(it.viewer_has_liked ?? it.metrics?.viewer_has_liked),
        },
        sponsor: null,
        sponsors: null,
      } as FeedItem;
    }).filter(Boolean) as FeedItem[];

    // Enrich with proper like status
    return await enrichWithLikeStatus(transformed);
  }, [enrichWithLikeStatus, userId]);

  // BASIC (legacy RPC)
  const fetchBasic = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_home_feed', {
      p_user_id: userId || null,
      p_limit: PAGE_SIZE,
      p_offset: offsetRef.current,
    });
    if (error) throw error;

    const out: FeedItem[] = [];
    (data ?? []).forEach((row: any) => {
      // event item
      out.push({
        item_type: 'event',
        sort_ts: row.start_at || new Date().toISOString(),
        item_id: row.event_id,
        event_id: row.event_id,
        event_title: row.title || 'Untitled Event',
        event_description: row.description || '',
        event_starts_at: row.start_at ?? null,
        event_cover_image: row.cover_image_url || '',
        // ✅ Use resolved value from SQL (falls back if someone hasn't run the migration yet)
        event_organizer: row.organizer_name
          || (row.owner_context_type === 'organization'
              ? (row.organization_name || row.organizer_display_name || 'Organization')
              : (row.organizer_display_name || 'Organizer')),
        event_organizer_id: row.organizer_id || (row.owner_context_type === 'organization'
          ? row.owner_context_id
          : row.created_by),
        event_owner_context_type: row.owner_context_type || 'individual',
        event_location: row.city || row.venue || 'TBA',
        author_id: null,
        author_name: null,
        author_badge: null,
        media_urls: null,
        content: null,
        metrics: { likes: 0, comments: 0 },
        sponsor: null,
        sponsors: null,
      });

      // post items (if present)
      if (Array.isArray(row.recent_posts)) {
        row.recent_posts.forEach((post: any) => {
          out.push({
            item_type: 'post',
            sort_ts: post.created_at || new Date().toISOString(),
            item_id: post.id,
            event_id: row.event_id,
            event_title: row.title || 'Untitled Event',
            event_description: row.description || '',
            event_starts_at: row.start_at ?? null,
            event_cover_image: row.cover_image_url || '',
            event_organizer: row.organizer_name
              || (row.owner_context_type === 'organization'
                  ? (row.organization_name || row.organizer_display_name || 'Organization')
                  : (row.organizer_display_name || 'Organizer')),
            event_organizer_id: row.organizer_id || (row.owner_context_type === 'organization'
              ? row.owner_context_id
              : row.created_by),
            event_owner_context_type: row.owner_context_type || 'individual',
            event_location: row.city || row.venue || 'TBA',
            author_id: post.author?.id || null,
            author_name: post.author?.display_name || null,
            author_badge: post.author?.badge_label || null,
            author_social_links: null,
            media_urls: post.media_urls || null,
            content: post.text || null,
            metrics: {
              likes: post.like_count || 0,
              comments: post.comment_count || 0,
              // BASIC path often lacks this; default false to avoid “first click = unlike”
              viewer_has_liked: Boolean(post.viewer_has_liked),
            },
            sponsor: null,
            sponsors: null,
          });
        });
      }
    });

    return out.sort(
      (a, b) => new Date(b.sort_ts).getTime() - new Date(a.sort_ts).getTime()
    );
  }, [userId]);

  // ---------- Paging ----------

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const newItems = SMART_FEED_ENABLED ? await fetchSmart() : await fetchBasic();

      offsetRef.current += newItems.length;

      setPages(prev => {
        const batchSeen = new Set<string>();
        const deduped = newItems.filter(it => {
          const k = keyOf(it);
          if (batchSeen.has(k)) return false;
          batchSeen.add(k);
          return true;
        });

        const last = deduped[deduped.length - 1];
        return [
          ...prev,
          { items: deduped, nextCursor: last ? { ts: last.sort_ts, id: last.item_id } : null },
        ];
      });
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message || 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [fetchBasic, fetchSmart]);

  const loadMore = useCallback(async () => {
    const lastPage = pages[pages.length - 1];
    if (lastPage?.nextCursor) await fetchPage();
  }, [pages, fetchPage]);

  const refresh = useCallback(() => {
    setPages([]);
    offsetRef.current = 0;
    fetchPage();
  }, [fetchPage]);

  const prependItem = useCallback((newItem: FeedItem) => {
    setPages(prev => {
      const key = keyOf(newItem);
      const seen = new Set(prev.flatMap(p => p.items.map(keyOf)));
      if (seen.has(key)) return prev;

      const [first, ...rest] = prev.length ? prev : [{ items: [], nextCursor: null }];
      return [{ ...first, items: [newItem, ...first.items] }, ...rest];
    });
  }, []);

  // ---------- Local mutators (no reorder) ----------

  const bumpPostCommentCount = useCallback((postId: string, newCount: number) => {
    setPages(prev =>
      prev.map(page => ({
        ...page,
        items: page.items.map(it =>
          it.item_type === 'post' && it.item_id === postId
            ? { ...it, metrics: { ...it.metrics, comments: newCount } }
            : it
        ),
      }))
    );
  }, []);

  // Set exact like count AND viewer_has_liked from server response
  const bumpPostLikeCount = useCallback(
    (postId: string, exactCount: number, liked?: boolean) => {
      setPages(prev =>
        prev.map(page => ({
          ...page,
          items: page.items.map(it =>
            it.item_type === 'post' && it.item_id === postId
              ? {
                  ...it,
                  metrics: {
                    ...it.metrics,
                    likes: exactCount,
                    viewer_has_liked: liked ?? it.metrics.viewer_has_liked ?? false,
                  },
                }
              : it
          ),
        }))
      );
    },
    []
  );

  // ---------- Real-time subscriptions ----------
  
  useEffect(() => {
    // Subscribe to real-time like updates
    const channel = supabase
      .channel('like-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_reactions',
          filter: 'kind=eq.like'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id;
            if (postId) {
              // Refresh the specific post's like count
              refreshPostLikes(postId);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refreshPostLikes = async (postId: string) => {
    try {
      const { count } = await supabase
        .from('event_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)
        .eq('kind', 'like');

      const { data: userLike } = await supabase
        .from('event_reactions')
        .select('*')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('kind', 'like')
        .maybeSingle();

      bumpPostLikeCount(postId, count ?? 0, Boolean(userLike));
    } catch (error) {
      console.error('Failed to refresh post likes:', error);
    }
  };

  // ---------- Lifecycle ----------

  useEffect(() => {
    setPages([]);
    offsetRef.current = 0;
    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, SMART_FEED_ENABLED]);

  // Force refresh on mount to pick up updated RPC function
  useEffect(() => {
    refresh();
  }, []);

  return {
    items,
    loading,
    error,
    loadMore,
    refresh,
    prependItem,
    bumpPostCommentCount,
    bumpPostLikeCount,
    hasMore: !!pages[pages.length - 1]?.nextCursor,
  };
}
