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
      const { data, error: queryError } = await supabase
        .from('event_sponsorships')
        .select(`
          *,
          sponsor_name:sponsors(name, logo_url)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      // Flatten the joined data
      const flattenedSponsorships = (data ?? []).map(sponsorship => ({
        ...sponsorship,
        sponsor_name: sponsorship.sponsor_name?.[0]?.name || 'Unknown Sponsor',
        sponsor_logo_url: sponsorship.sponsor_name?.[0]?.logo_url || null,
        benefits: sponsorship.benefits as Record<string, any>,
        status: sponsorship.status as 'active' | 'expired' | 'revoked'
      }));

      setSponsorships(flattenedSponsorships);
    } catch (err) {
      console.error('Error fetching event sponsorships:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sponsorships');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchSponsorships();
  }, [fetchSponsorships]);

  return { sponsorships, loading, error, refresh: fetchSponsorships };
}