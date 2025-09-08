// src/hooks/useHomeFeed.ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';

/** ---------- Types returned to the page (aligns with Index.tsx expectations) ---------- */
type EventPost = {
  id: string;
  authorName: string;
  authorBadge: 'ORGANIZER' | 'ATTENDEE';
  isOrganizer?: boolean;
  content: string;
  timestamp: string;
  likes: number;
  mediaType?: 'image' | 'video' | 'none';
  mediaUrl?: string;
  thumbnailUrl?: string;
  commentCount?: number;
  /** extras needed for deep linking / clicks */
  authorId?: string;
  ticketTierId?: string;
  ticketBadge?: string;
};

type TicketTier = {
  id: string;
  name: string;
  price: number;
  badge: string;
  available: number;
  total: number;
};

export type HomeFeedEvent = {
  id: string;
  title: string;
  description: string;
  organizer: string;
  organizerId: string;
  category: string;
  startAtISO: string;
  endAtISO?: string;
  dateLabel: string;
  location: string;
  coverImage: string;
  ticketTiers: TicketTier[];
  attendeeCount: number;
  likes: number;
  shares: number;
  isLiked?: boolean;
  posts?: EventPost[];
};

/** ---------- Helpers ---------- */
function firstUrl(arr: unknown): string | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const v = arr[0];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function inferMediaType(url?: string): 'image' | 'video' | 'none' {
  if (!url) return 'none';
  const lower = url.toLowerCase();
  if (lower.includes('mux') || lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.m3u8')) {
    return 'video';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp') || lower.endsWith('.gif')) {
    return 'image';
  }
  // default to image so we at least show something if it's a thumbnail-like URL
  return 'image';
}

function safeNumber(n: unknown, fallback = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function safeString(s: unknown, fallback = ''): string {
  return typeof s === 'string' ? s : fallback;
}

/** ---------- Hook ---------- */
export function useHomeFeed(postLimit = 3) {
  const [data, setData] = useState<HomeFeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;

      // RPC signature: get_home_feed(p_user_id, p_limit, p_offset)
      const { data: rows, error: rpcErr } = await supabase.rpc('get_home_feed', {
        p_user_id: userId,
        p_limit: 20,
        p_offset: 0,
      });

      if (rpcErr) throw rpcErr;

      const events: HomeFeedEvent[] = (rows ?? []).map((row: any) => {
        // Accept either event_id or id from RPC
        const eventId: string = (row?.event_id ?? row?.id) as string;

        const startISO: string = safeString(row?.start_at);
        const endISO: string | undefined = (row?.end_at as string | null) ?? undefined;

        const dateLabel: string =
          startISO && !Number.isNaN(Date.parse(startISO))
            ? new Date(startISO).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : '';

        // Normalize organizer fields
        const organizerDisplay: string =
          safeString(row?.organizer_display_name) ||
          safeString(row?.organizer) ||
          'Organizer';

        const organizerId: string = safeString(row?.created_by);

        // Ticket tiers
        const tiersArray: any[] = Array.isArray(row?.ticket_tiers) ? row.ticket_tiers : [];
        const tiers: TicketTier[] = tiersArray.map((t: any) => ({
          id: safeString(t?.id),
          name: safeString(t?.name),
          price: safeNumber(t?.price_cents, 0) / 100,
          badge: safeString(t?.badge_label),
          available: safeNumber(t?.quantity, 0),
          total: safeNumber(t?.quantity, 0),
        }));

        // Posts (accept recent_posts or posts)
        const postsArray: any[] = Array.isArray(row?.recent_posts)
          ? row.recent_posts
          : Array.isArray(row?.posts)
          ? row.posts
          : [];

        const posts: EventPost[] = postsArray
          .slice(0, postLimit) // soft limit client-side
          .map((p: any) => {
            // Media
            const rawUrl =
              firstUrl(p?.media_urls) ??
              safeString(p?.media_url) ??
              safeString(p?.thumbnail_url) ??
              undefined;
            const mediaType = inferMediaType(rawUrl);

            // Author
            const authorObj = p?.author ?? p?.user ?? null;
            const authorName =
              safeString(authorObj?.display_name) ||
              safeString(p?.authorName) ||
              safeString(p?.author_name) ||
              'Anonymous';
            const authorId = safeString(authorObj?.id ?? p?.author_user_id);

            // Badge / tier from RPC if present
            const ticketBadge =
              safeString(authorObj?.badge_label) ||
              safeString(p?.tier_badge_label) ||
              safeString(p?.ticket_badge_label) ||
              '';
            const ticketTierId = safeString(p?.ticket_tier_id);

            console.log('🎯 Processing post for', authorName, {
              badge_label: authorObj?.badge_label,
              tier_badge_label: p?.tier_badge_label,
              ticket_badge_label: p?.ticket_badge_label,
              finalTicketBadge: ticketBadge,
              isOrganizer: !!authorObj?.is_organizer
            });

            return {
              id: safeString(p?.id),
              authorName,
              authorBadge: authorObj?.is_organizer ? 'ORGANIZER' : 'ATTENDEE',
              isOrganizer: !!authorObj?.is_organizer,
              content: safeString(p?.text),
              timestamp: new Date(safeString(p?.created_at) || Date.now()).toLocaleDateString(),
              likes: safeNumber(p?.like_count),
              mediaType,
              mediaUrl: rawUrl,
              thumbnailUrl: mediaType === 'image' ? rawUrl : undefined,
              commentCount: safeNumber(p?.comment_count),
              authorId: authorId || undefined,
              ticketTierId: ticketTierId || undefined,
              ticketBadge: ticketBadge || undefined,
            };
          });

        console.log('🎯 Processed posts for event:', safeString(row?.title), posts.map(p => ({
          author: p.authorName,
          authorId: p.authorId,
          ticketBadge: p.ticketBadge,
          isOrganizer: p.isOrganizer
        })));

        return {
          id: eventId,
          title: safeString(row?.title),
          description: safeString(row?.description),
          organizer: organizerDisplay,
          organizerId,
          category: safeString(row?.category) || 'Event',
          startAtISO: startISO,
          endAtISO: endISO,
          dateLabel,
          location: safeString(row?.city) || safeString(row?.venue) || 'TBA',
          coverImage: safeString(row?.cover_image_url) || DEFAULT_EVENT_COVER,
          ticketTiers: tiers,
          attendeeCount: Math.floor(Math.random() * 1000) + 50, // TODO: replace with real count if available
          likes: Math.floor(Math.random() * 500) + 10,
          shares: Math.floor(Math.random() * 100) + 5,
          isLiked: false,
          posts,
        };
      });

      setData(events);
    } catch (err) {
      console.error('[useHomeFeed] error:', err);
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [postLimit]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return { data, loading, error, refresh: fetchFeed, setData };
}