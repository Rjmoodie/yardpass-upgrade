import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sponsor } from '@/types/sponsors';

export function useSponsorAccounts(userId?: string) {
  const [accounts, setAccounts] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSponsors = useCallback(async () => {
    if (!userId) {
      setAccounts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First get sponsor IDs user belongs to
      const { data: memberships, error: membershipError } = await supabase
        .from('sponsor_members')
        .select('sponsor_id')
        .eq('user_id', userId);

      if (membershipError) throw membershipError;

      const sponsorIds = (memberships ?? []).map(m => m.sponsor_id);

      if (sponsorIds.length === 0) {
        setAccounts([]);
        setLoading(false);
        return;
      }

      // Then get sponsor details
      const { data: sponsors, error: sponsorError } = await supabase
        .from('sponsors')
        .select('*')
        .in('id', sponsorIds);

      if (sponsorError) throw sponsorError;

      setAccounts(sponsors ?? []);
    } catch (err) {
      console.error('Error fetching sponsor accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sponsor accounts');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  return { accounts, loading, error, refresh: fetchSponsors };
}