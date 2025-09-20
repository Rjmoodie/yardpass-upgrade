import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SearchFilters = {
  category?: string | null;
  dateFrom?: string | null; // ISO
  dateTo?: string | null;   // ISO
  onlyEvents?: boolean;
};

export type SearchRow = {
  item_type: string;
  item_id: string;
  title: string;
  description: string;
  content: string;
  category: string | null;
  created_at: string;
  cover_image_url: string | null;
  organizer_name: string;
  location: string;
  start_at: string | null;
  visibility: string;
};

export function useSmartSearch(initialQ = '') {
  const [q, setQ] = useState(initialQ);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Debounce
  const tRef = useRef<number | null>(null);
  const debouncedQ = useMemo(() => q.trim(), [q]);

  const search = useCallback(async (reset = true) => {
    if (reset) setPage(0);
    setLoading(true);
    setError(null);
    try {
      // Get current user for authentication
      const { data: { user } } = await supabase.auth.getUser();
      
      // Convert ISO date strings to Date objects to ensure proper type casting
      let dateFrom = null;
      let dateTo = null;
      
      if (filters.dateFrom) {
        dateFrom = new Date(filters.dateFrom).toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
      }
      if (filters.dateTo) {
        dateTo = new Date(filters.dateTo).toISOString().split('T')[0]; // Convert to YYYY-MM-DD format  
      }
      
      // Call search function with proper user context and date casting
      const { data, error } = await supabase.rpc('search_all', {
        p_user: user?.id ?? null,
        p_q: debouncedQ,
        p_category: filters.category ?? null,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_only_events: !!filters.onlyEvents,
        p_limit: pageSize,
        p_offset: (reset ? 0 : page * pageSize),
      });
      if (error) {
        console.error('Search error:', error);
        throw error;
      }
      const rows = (data ?? []) as SearchRow[];
      setResults((prev) => (reset ? rows : [...prev, ...rows]));
    } catch (e) {
      console.error('Search failed:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, filters, page]);

  // Autosearch after typing pause
  useEffect(() => {
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      search(true);
    }, 200);
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, [debouncedQ, filters, search]);

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  useEffect(() => {
    if (page === 0) return;
    search(false);
  }, [page, search]);

  return {
    q, setQ,
    filters, setFilters,
    results, loading, error,
    loadMore, pageSize
  };
}