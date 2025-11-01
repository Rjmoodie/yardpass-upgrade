import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EventSponsorship } from '@/types/sponsors';

export function useEventSponsorships(eventId?: string) {
  const [sponsorships, setSponsorships] = useState<EventSponsorship[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSponsorships = useCallback(async () => {
    if (!eventId) {
      setSponsorships([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Query sponsorship_orders (actual purchased/active sponsorships)
      const { data, error: queryError } = await supabase
        .from('sponsorship_orders')
        .select(`
          *,
          sponsor:sponsors(name, logo_url),
          package:sponsorship_packages(tier, price_cents, benefits)
        `)
        .eq('event_id', eventId)
        .in('status', ['pending', 'accepted', 'live', 'completed'])
        .order('created_at', { ascending: false });

      if (queryError) {
        console.warn('Error fetching sponsorships:', queryError.message);
        setSponsorships([]);
        return;
      }

      // Flatten the joined data
      const flattenedSponsorships = (data ?? []).map(order => ({
        id: order.id,
        event_id: order.event_id,
        sponsor_id: order.sponsor_id,
        sponsor_name: order.sponsor?.name || 'Unknown Sponsor',
        sponsor_logo_url: order.sponsor?.logo_url || null,
        tier: order.package?.tier || 'standard',
        amount_cents: order.amount_cents,
        price_cents: order.package?.price_cents || order.amount_cents,
        benefits: order.package?.benefits as Record<string, any> || {},
        status: order.status as 'active' | 'expired' | 'revoked',
        created_at: order.created_at,
        notes: order.notes,
      }));

      setSponsorships(flattenedSponsorships);
    } catch (err) {
      console.warn('Error fetching event sponsorships:', err);
      setSponsorships([]);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchSponsorships();
  }, [fetchSponsorships]);

  return { sponsorships, loading, error, refresh: fetchSponsorships };
}