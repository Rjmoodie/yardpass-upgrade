// Organizations hook with SWR-like caching
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; ts: number }>();

export function useOrganizations(userId?: string) {
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async () => {
    if (!userId) {
      setOrganizations([]);
      return;
    }

    const cacheKey = `orgs-${userId}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setOrganizations(cached.data);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_user_organizations', { user_uuid: userId });

      if (fetchError) {
        throw fetchError;
      }

      const orgs = data || [];
      setOrganizations(orgs);
      cache.set(cacheKey, { data: orgs, ts: Date.now() });
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
      setError(err.message || 'Failed to fetch organizations');
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  return {
    organizations,
    loading,
    error
  };
}