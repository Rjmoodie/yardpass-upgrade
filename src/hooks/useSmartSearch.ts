// src/hooks/useSmartSearch.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SearchFilters = {
  category?: string | null;
  dateFrom?: string | null; // ISO string
  dateTo?: string | null;   // ISO string
  onlyEvents?: boolean;
};

export type SearchRow = {
  item_type: 'event' | 'post';
  item_id: string;                  // event_id for events, post_id for posts
  parent_event_id?: string | null;  // populated when item_type === 'post'
  title: string;
  description: string;
  content: string;
  category: string | null;
  created_at: string;
  cover_image_url: string | null;
  organizer_name: string | null;
  location: string | null;
  start_at: string | null;
  visibility: 'public' | 'unlisted' | 'private';
};

function toYMD(dateISO?: string | null): string | null {
  if (!dateISO) return null;
  try {
    const d = new Date(dateISO);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch {
    return null;
  }
}

export function useSmartSearch(initialQ = '') {
  const [q, setQ] = useState(initialQ);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // debounce control
  const debounceRef = useRef<number | null>(null);

  // request versioning (drops stale responses)
  const reqVersion = useRef(0);

  const debouncedQ = useMemo(() => q.trim(), [q]);

  const search = useCallback(
    async (reset = true) => {
      const myVersion = ++reqVersion.current;
      if (reset) setPage(0);
      setLoading(true);
      setError(null);
      try {
        // current user (visibility-aware)
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id ?? null;

        const p_date_from = toYMD(filters.dateFrom);
        const p_date_to = toYMD(filters.dateTo);

        const { data, error } = await supabase.rpc('search_all', {
          p_user: userId,
          p_q: debouncedQ || null,
          p_category: filters.category ?? null,
          p_date_from,
          p_date_to,
          p_only_events: !!filters.onlyEvents,
          p_limit: pageSize,
          p_offset: reset ? 0 : page * pageSize,
        });

        if (error) throw error;
        if (myVersion !== reqVersion.current) return; // stale, ignore

        const rows = (data ?? []) as SearchRow[];

        setResults(prev => (reset ? rows : [...prev, ...rows]));
      } catch (e) {
        if (myVersion !== reqVersion.current) return;
        console.error('Search failed:', e);
        setError(e);
      } finally {
        if (myVersion === reqVersion.current) {
          setLoading(false);
        }
      }
    },
    [debouncedQ, filters.category, filters.dateFrom, filters.dateTo, filters.onlyEvents, page, pageSize]
  );

  // trigger search when query/filters change (debounced)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      search(true);
    }, 220);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [debouncedQ, filters, search]);

  // paging
  const loadMore = useCallback(() => {
    setPage(p => p + 1);
  }, []);

  useEffect(() => {
    if (page === 0) return;
    search(false);
  }, [page, search]);

  // helpers
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    q, setQ,
    filters, setFilters, clearFilters,
    results, loading, error,
    loadMore, pageSize,
  };
}
