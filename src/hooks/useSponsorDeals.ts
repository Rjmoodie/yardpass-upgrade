import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SponsorshipOrder } from '@/types/sponsors';

export function useSponsorDeals(sponsorId?: string | null) {
  const [deals, setDeals] = useState<SponsorshipOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    if (!sponsorId) {
      setDeals([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('sponsorship_orders')
        .select(`
          *,
          event_title:events(title),
          sponsor_name:sponsors(name)
        `)
        .eq('sponsor_id', sponsorId)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      // Flatten the joined data
      const flattenedDeals = (data ?? []).map(deal => ({
        ...deal,
        event_title: deal.event_title?.[0]?.title || 'Unknown Event',
        sponsor_name: deal.sponsor_name?.[0]?.name || 'Unknown Sponsor'
      }));

      setDeals(flattenedDeals);
    } catch (err) {
      console.error('Error fetching sponsor deals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch deals');
    } finally {
      setLoading(false);
    }
  }, [sponsorId]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  return { deals, loading, error, refresh: fetchDeals };
}