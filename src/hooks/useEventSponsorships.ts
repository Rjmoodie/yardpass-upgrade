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
      // Query sponsorship_orders without embedded joins (to avoid 400 errors through public views)
      const { data: ordersData, error: queryError } = await supabase
        .from('sponsorship_orders')
        .select('id, event_id, sponsor_id, package_id, amount_cents, status, created_at, notes')
        .eq('event_id', eventId)
        .in('status', ['pending', 'accepted', 'live', 'completed'])
        .order('created_at', { ascending: false });

      if (queryError) {
        console.warn('Error fetching sponsorships:', queryError.message);
        setSponsorships([]);
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setSponsorships([]);
        return;
      }

      // Fetch related sponsors and packages separately
      const sponsorIds = [...new Set(ordersData.map(o => o.sponsor_id))];
      const packageIds = [...new Set(ordersData.map(o => o.package_id))];

      const { data: sponsorsData, error: sponsorsError } = await supabase
        .from('sponsors')
        .select('id, name, logo_url')
        .in('id', sponsorIds);

      if (sponsorsError) {
        console.error('Error fetching sponsors:', sponsorsError);
      }

      const { data: packagesData, error: packagesError } = await supabase
        .from('sponsorship_packages')
        .select('id, tier, price_cents, benefits')
        .in('id', packageIds);

      if (packagesError) {
        console.error('Error fetching packages:', packagesError);
      }

      // Create lookup maps for efficient joining
      const sponsorsMap = new Map(sponsorsData?.map(s => [s.id, s]) || []);
      const packagesMap = new Map(packagesData?.map(p => [p.id, p]) || []);

      // Join data in application code
      const flattenedSponsorships = ordersData.map(order => {
        const sponsor = sponsorsMap.get(order.sponsor_id);
        const pkg = packagesMap.get(order.package_id);

        return {
          id: order.id,
          event_id: order.event_id,
          sponsor_id: order.sponsor_id,
          sponsor_name: sponsor?.name || 'Unknown Sponsor',
          sponsor_logo_url: sponsor?.logo_url || null,
          tier: pkg?.tier || 'standard',
          amount_cents: order.amount_cents,
          price_cents: pkg?.price_cents || order.amount_cents,
          benefits: (pkg?.benefits as Record<string, any>) || {},
          status: order.status as 'active' | 'expired' | 'revoked',
          created_at: order.created_at,
          notes: order.notes,
        };
      });

      setSponsorships(flattenedSponsorships);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch sponsorships';
      console.warn('Error fetching event sponsorships:', err);
      setSponsorships([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchSponsorships();
  }, [fetchSponsorships]);

  return { sponsorships, loading, error, refresh: fetchSponsorships };
}