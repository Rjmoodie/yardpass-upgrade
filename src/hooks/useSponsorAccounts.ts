import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sponsor } from '@/types/sponsors';

export function useSponsorAccounts(userId?: string) {
  const [accounts, setAccounts] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSponsorAccess, setHasSponsorAccess] = useState(false);

  const createSponsor = useCallback(async (data: {
    name: string;
    website_url?: string;
    contact_email?: string;
  }) => {
    if (!userId) throw new Error('User not authenticated');

    const { data: sponsor, error: sponsorError } = await supabase
      .from('sponsorship.sponsors')
      .insert({
        ...data,
        created_by: userId
      })
      .select()
      .single();

    if (sponsorError) throw sponsorError;

    // Add user as owner
    const { error: memberError } = await supabase
      .from('sponsorship.sponsor_members')
      .insert({
        sponsor_id: sponsor.id,
        user_id: userId,
        role: 'owner'
      });

    if (memberError) throw memberError;

    // Refresh accounts list
    await fetchSponsors();
    
    return sponsor;
  }, [userId]);

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
        .from('sponsorship.sponsor_members')
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
        .from('sponsorship.sponsors')
        .select('*')
        .in('id', sponsorIds);

      if (sponsorError) throw sponsorError;

      setAccounts(sponsors ?? []);
      setHasSponsorAccess((sponsors ?? []).length > 0);
    } catch (err) {
      console.error('Error fetching sponsor accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sponsor accounts');
      setHasSponsorAccess(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  return { accounts, loading, error, hasSponsorAccess, refresh: fetchSponsors, createSponsor };
}