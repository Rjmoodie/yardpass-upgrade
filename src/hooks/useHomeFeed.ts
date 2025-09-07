import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';

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

function firstUrl(arr: string[] | null | undefined): string | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr[0] || undefined;
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
  return 'image'; // default to image for thumbnails
}

export function useHomeFeed(postLimit = 3) {
  const [data, setData] = useState<HomeFeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🚀 useHomeFeed: Starting RPC call for optimized home feed');
      const startTime = performance.now();
      
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id ?? null;
      
      console.log('👤 useHomeFeed: User ID:', userId ? 'authenticated' : 'anonymous');

      const { data: rows, error: rpcErr } = await supabase.rpc('get_home_feed', {
        p_user_id: userId,
        p_limit: 20,
        p_offset: 0
      });

      const fetchTime = performance.now() - startTime;
      console.log(`⚡ useHomeFeed: RPC completed in ${fetchTime.toFixed(2)}ms`);

      if (rpcErr) {
        console.error('❌ useHomeFeed: RPC error:', rpcErr);
        throw rpcErr;
      }
      
      console.log(`📊 useHomeFeed: Fetched ${rows?.length || 0} events with embedded posts and tiers`);

      const events: HomeFeedEvent[] = (rows || []).map((row: any) => {
        const startISO: string = row.start_at;
        const endISO: string | undefined = row.end_at ?? undefined;
        const dateLabel = new Date(startISO).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

        // Extract ticket tiers from RPC result
        const tiersArray = Array.isArray(row.ticket_tiers) ? row.ticket_tiers : [];
        const tiers: TicketTier[] = tiersArray.map((t: any) => ({
          id: t.id,
          name: t.name,
          price: (t.price_cents || 0) / 100,
          badge: t.badge_label || '',
          available: t.quantity ?? 0,
          total: t.quantity ?? 0,
        }));

        // Extract posts from RPC result
        const postsArray = Array.isArray(row.recent_posts) ? row.recent_posts : [];
        const posts: EventPost[] = postsArray.map((p: any) => {
          const url = firstUrl(p.media_urls);
          const mediaType = inferMediaType(url);
          return {
            id: p.id,
            authorName: p.author?.display_name || 'Anonymous',
            authorBadge: p.author?.is_organizer ? 'ORGANIZER' : 'ATTENDEE',
            isOrganizer: !!p.author?.is_organizer,
            content: p.text || '',
            timestamp: new Date(p.created_at).toLocaleDateString(),
            likes: p.like_count || 0,
            mediaType,
            mediaUrl: url,
            thumbnailUrl: mediaType === 'image' ? url : undefined,
            commentCount: p.comment_count || 0,
          };
        });

        return {
          id: row.event_id,
          title: row.title,
          description: row.description || '',
          organizer: row.organizer_display_name || 'Organizer',
          organizerId: row.created_by,
          category: row.category || 'Event',
          startAtISO: startISO,
          endAtISO: endISO,
          dateLabel,
          location: row.city || row.venue || 'TBA',
          coverImage: row.cover_image_url || DEFAULT_EVENT_COVER,
          ticketTiers: tiers,
          attendeeCount: Math.floor(Math.random() * 1000) + 50, // TODO: Add real attendee count
          likes: Math.floor(Math.random() * 500) + 10,
          shares: Math.floor(Math.random() * 100) + 5,
          isLiked: false,
          posts,
        };
      });

      setData(events);
    } catch (err) {
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
