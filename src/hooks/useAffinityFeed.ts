import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Minimal shape the page expects. Extend if needed.
export interface FeedEventLite {
  id: string;
  title: string;
  description: string | null;
  organizerId: string | null;
  organizerName?: string | null;
  organizerVerified?: boolean;
  coverImage: string | null;
  startAtISO: string | null;
  location: string | null;
  attendeeCount?: number | null;
  minPrice?: number | null;     // for "From $X"
  remaining?: number | null;    // for "Last X left"
}

export function useAffinityFeed(limit = 8) {
  const [data, setData] = useState<FeedEventLite[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setErr] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);

        // 1) Who am I?
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id || null;

        // 2) Ranked event IDs
        const { data: ranked, error: rpcError } = await supabase
          .rpc('get_home_feed_ids', { p_user_id: userId, p_limit: limit });

        if (rpcError) throw rpcError;

        const ids: string[] = (ranked || []).map((r: any) => r.event_id);
        if (ids.length === 0) {
          if (mounted) { setData([]); setLoading(false); }
          return;
        }

        // 3) Fetch light event metadata + organizer + min price + remaining
        const { data: events, error: evErr } = await supabase
          .from('events')
          .select(`
            id, title, description, start_at, end_at, venue, city, country,
            cover_image_url, owner_context_id, owner_context_type,
            organizations:organizations!events_owner_context_id_fkey(id, name, handle, is_verified),
            ticket_tiers (price_cents, total_quantity, sold_quantity)
          `)
          .in('id', ids);

        if (evErr) throw evErr;

        // massage
        const mapped: FeedEventLite[] = (events || []).map((e: any) => {
          const minPrice = e.ticket_tiers?.length
            ? Math.min(...e.ticket_tiers.map((t: any) => t.price_cents ?? Infinity))
            : null;
          const remaining = e.ticket_tiers?.length
            ? Math.max(0, e.ticket_tiers.reduce((sum: number, t: any) =>
                sum + Math.max(0, (t.total_quantity ?? 0) - (t.sold_quantity ?? 0)), 0))
            : null;

          return {
            id: e.id,
            title: e.title,
            description: e.description,
            organizerId: e.owner_context_type === 'organization' ? e.owner_context_id : null,
            organizerName: e.organizations?.name ?? null,
            organizerVerified: !!e.organizations?.is_verified,
            coverImage: e.cover_image_url,
            startAtISO: e.start_at,
            location: [e.venue, e.city, e.country].filter(Boolean).join(' • ') || null,
            attendeeCount: null, // fill if you keep a counter table
            minPrice,
            remaining,
          };
        });

        // Keep the ranked order
        const orderMap = new Map(ids.map((id, i) => [id, i]));
        mapped.sort((a, b) => (orderMap.get(a.id)! - orderMap.get(b.id)!));

        if (mounted) setData(mapped);
      } catch (err) {
        console.error(err);
        if (mounted) setErr(err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [limit]);

  return { data, loading, error, setData };
}
