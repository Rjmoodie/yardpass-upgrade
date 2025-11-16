// src/hooks/useOrganizations.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type OrgRow = {
  id: string;
  name: string;
  verification_status?: 'none' | 'pending' | 'verified' | string | null;
  is_verified?: boolean | null; // in case RPC returns this already
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: OrgRow[]; ts: number }>();
const storage = typeof window !== 'undefined' ? window.localStorage : undefined;

function normalizeOrgs(rows: OrgRow[]): OrgRow[] {
  return (rows || []).map((o) => ({
    ...o,
    // prefer explicit boolean if present, else derive from status
    is_verified: typeof o.is_verified === 'boolean'
      ? o.is_verified
      : (o.verification_status === 'verified'),
    verification_status: o.verification_status || (o.is_verified ? 'verified' : 'none'),
  }));
}

export function useOrganizations(userId?: string) {
  const [organizations, setOrganizations] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const cacheKey = userId ? `orgs-${userId}` : 'orgs-anon';
  const storageKey = userId ? `liventix:last-org-snapshot:${userId}` : null;

  const setSafe = useCallback((rows: OrgRow[]) => {
    if (!mounted.current) return;
    const normalized = normalizeOrgs(rows);
    setOrganizations(normalized);
    cache.set(cacheKey, { data: normalized, ts: Date.now() });
    if (storage && storageKey) {
      try {
        storage.setItem(storageKey, JSON.stringify(normalized));
      } catch {
        // ignore storage failures
      }
    }
    setResolved(true);
  }, [cacheKey, storageKey]);

  // Hydrate from the previous successful fetch for instant UX
  useEffect(() => {
    if (!storage || !storageKey) return;
    const stored = storage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as OrgRow[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrganizations(normalizeOrgs(parsed));
        }
      } catch {
        storage.removeItem(storageKey);
      }
    }
  }, [storageKey]);

  const fetchOrganizations = useCallback(async (opts?: { bypassCache?: boolean }) => {
    if (!userId) {
      setOrganizations([]);
      setLoading(false);
      setResolved(true);
      return;
    }

    setError(null);
    setLoading(true);

    if (!opts?.bypassCache) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setOrganizations(cached.data);
        setLoading(false);
        setResolved(true);
        return;
      }
    }
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_user_organizations', { user_uuid: userId });

      if (fetchError) throw fetchError;
      setSafe(data || []);
    } catch (err: any) {
      console.error('Failed to fetch organizations:', err);
      setError(err.message || 'Failed to fetch organizations');
      setOrganizations([]);
    } finally {
      setLoading(false);
      setResolved(true);
    }
  }, [userId, cacheKey, setSafe]);

  const invalidate = useCallback(() => {
    cache.delete(cacheKey);
    return fetchOrganizations({ bypassCache: true });
  }, [cacheKey, fetchOrganizations]);

  useEffect(() => {
    mounted.current = true;
    fetchOrganizations();
    return () => { mounted.current = false; };
  }, [fetchOrganizations]);

  // Optional: realtime refresh on org changes relevant to user
  useEffect(() => {
    if (!userId) return;
    // Adjust table/filter names to your schema if different
    const ch = supabase
      .channel(`orgs-${userId}`)
      // if you have an org_members table, listen to changes
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'org_members', filter: `user_id=eq.${userId}` },
        () => invalidate(),
      )
      // if verification status changes on organizations
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'organizations' },
        () => invalidate(),
      )
      .subscribe();

    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [userId, invalidate]);

  return {
    organizations,
    loading,
    resolved,
    error,
    refresh: () => fetchOrganizations({ bypassCache: true }),
    invalidate,
  };
}
