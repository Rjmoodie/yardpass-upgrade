// src/hooks/useSmartSearch.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SearchFilters = {
  category?: string | null;
  dateFrom?: string | null; // ISO string
  dateTo?: string | null;   // ISO string
  city?: string | null;
  near?: {
    lat: number;
    lng: number;
    radiusKm?: number | null;
  } | null;
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

type UseSmartSearchOptions = {
  initialQuery?: string;
  initialFilters?: SearchFilters;
  pageSize?: number;
  debounceMs?: number;
  minimumQueryLength?: number;
};

type CacheEntry = {
  rows: SearchRow[];
  hasMore: boolean;
  fetchedAt: number;
};

const DEFAULT_OPTIONS: Required<Omit<UseSmartSearchOptions, 'initialQuery' | 'initialFilters'>> = {
  pageSize: 20,
  debounceMs: 220,
  minimumQueryLength: 0,
};

export function useSmartSearch(options: string | UseSmartSearchOptions = '') {
  const opts: UseSmartSearchOptions = typeof options === 'string' ? { initialQuery: options } : options;
  const { initialQuery = '', initialFilters = {}, pageSize, debounceMs, minimumQueryLength } = {
    initialQuery: opts.initialQuery ?? '',
    initialFilters: opts.initialFilters ?? {},
    ...DEFAULT_OPTIONS,
    pageSize: opts.pageSize ?? DEFAULT_OPTIONS.pageSize,
    debounceMs: opts.debounceMs ?? DEFAULT_OPTIONS.debounceMs,
    minimumQueryLength: opts.minimumQueryLength ?? DEFAULT_OPTIONS.minimumQueryLength,
  };

  const [qState, setQState] = useState(initialQuery);
  const [filtersState, setFiltersState] = useState<SearchFilters>(initialFilters);
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalFetched, setTotalFetched] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [isStale, setIsStale] = useState(false);

  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const pageRef = useRef(0);

  // debounce control
  const debounceRef = useRef<number | null>(null);

  // request versioning (drops stale responses)
  const reqVersion = useRef(0);
  const lastQueryKeyRef = useRef<string>('');

  const debouncedQ = useMemo(() => qState.trim(), [qState]);
  const normalizedFilters = useMemo(() => {
    const nearRaw = filtersState.near;
    let nearNormalized: SearchFilters['near'] = null;

    if (nearRaw) {
      const lat = Number(nearRaw.lat);
      const lng = Number(nearRaw.lng);
      const radiusValue =
        nearRaw.radiusKm === undefined || nearRaw.radiusKm === null
          ? null
          : Number(nearRaw.radiusKm);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        nearNormalized = {
          lat,
          lng,
          radiusKm: radiusValue !== null && Number.isFinite(radiusValue) ? radiusValue : null,
        };
      }
    }

    return {
      category: filtersState.category ?? null,
      dateFrom: filtersState.dateFrom ?? null,
      dateTo: filtersState.dateTo ?? null,
      city: filtersState.city ?? null,
      near: nearNormalized,
      onlyEvents: filtersState.onlyEvents ?? false,
    };
  }, [filtersState]);

  const filtersKey = useMemo(() => JSON.stringify(normalizedFilters), [normalizedFilters]);
  const queryKey = useMemo(
    () => JSON.stringify({ q: debouncedQ, filters: normalizedFilters }),
    [debouncedQ, normalizedFilters]
  );

  const setQ = useCallback(
    (next: string | ((prev: string) => string)) => {
      setQState(prev => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        if (resolved !== prev) {
          setIsStale(true);
        }
        return resolved;
      });
    },
    []
  );

  const setFilters = useCallback(
    (next: SearchFilters | ((prev: SearchFilters) => SearchFilters)) => {
      setFiltersState(prev => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        const prevKey = JSON.stringify(prev ?? {});
        const nextKey = JSON.stringify(resolved ?? {});
        if (prevKey !== nextKey) {
          setIsStale(true);
        }
        return { ...resolved };
      });
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters(() => ({}));
  }, [setFilters]);

  const mergeAndDedupe = useCallback((prev: SearchRow[], incoming: SearchRow[]) => {
    if (!incoming.length) return prev;
    const map = new Map<string, SearchRow>();
    for (const row of prev) {
      map.set(`${row.item_type}:${row.item_id}`, row);
    }
    for (const row of incoming) {
      map.set(`${row.item_type}:${row.item_id}`, row);
    }
    return Array.from(map.values());
  }, []);

  const executeSearch = useCallback(
    async (reset: boolean, pageOverride?: number) => {
      const targetPage = pageOverride ?? (reset ? 0 : pageRef.current);
      const myVersion = ++reqVersion.current;

      if (reset) {
        pageRef.current = 0;
        setPage(0);
        setTotalFetched(0);
      }

      const trimmedQ = debouncedQ;
      const tooShort = trimmedQ.length < minimumQueryLength;

      if (reset) {
        const cached = cacheRef.current.get(queryKey);
        if (cached) {
          setResults(cached.rows);
          setHasMore(cached.hasMore);
          setTotalFetched(cached.rows.length);
          setLastUpdatedAt(cached.fetchedAt);
          setIsStale(true);
        } else {
          setResults([]);
        }
      }

      if (tooShort && !normalizedFilters.category && !normalizedFilters.dateFrom && !normalizedFilters.dateTo) {
        setLoading(false);
        setError(null);
        setHasMore(false);
        if (reset) {
          cacheRef.current.delete(queryKey);
          setResults([]);
          setTotalFetched(0);
          setLastUpdatedAt(null);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id ?? null;

        const p_date_from = toYMD(normalizedFilters.dateFrom);
        const p_date_to = toYMD(normalizedFilters.dateTo);

        const { data, error } = await supabase.rpc('search_all', {
          p_user: userId,
          p_q: trimmedQ || null,
          p_category: normalizedFilters.category,
          p_date_from,
          p_date_to,
          p_only_events: !!normalizedFilters.onlyEvents,
          p_limit: pageSize,
          p_offset: targetPage * pageSize,
        });

        if (error) throw error;
        if (myVersion !== reqVersion.current) return; // stale response, ignore

        const rows = (data ?? []) as SearchRow[];
        setResults(prev => (reset ? rows : mergeAndDedupe(prev, rows)));
        setHasMore(rows.length === pageSize);
        setTotalFetched(prev => (reset ? rows.length : prev + rows.length));
        setLastUpdatedAt(Date.now());
        setIsStale(false);

        cacheRef.current.set(queryKey, {
          rows: reset ? rows : mergeAndDedupe(cacheRef.current.get(queryKey)?.rows ?? [], rows),
          hasMore: rows.length === pageSize,
          fetchedAt: Date.now(),
        });

        pageRef.current = targetPage;
        if (!reset) setPage(targetPage);
        lastQueryKeyRef.current = queryKey;
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
    [debouncedQ, minimumQueryLength, normalizedFilters, pageSize, queryKey, mergeAndDedupe]
  );

  // trigger search when query/filters change (debounced)
  useEffect(() => {
    if (lastQueryKeyRef.current === queryKey && !isStale) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void executeSearch(true);
    }, debounceMs);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [queryKey, debounceMs, executeSearch, isStale]);

  // paging
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    setPage(nextPage);
  }, [loading, hasMore]);

  useEffect(() => {
    if (page === 0) return;
    void executeSearch(false, page);
  }, [page, executeSearch]);

  const retry = useCallback(() => {
    void executeSearch(true, 0);
  }, [executeSearch]);

  const isInitialLoading = loading && results.length === 0;
  const isEmpty = !loading && results.length === 0;

  return {
    q: qState,
    setQ,
    filters: filtersState,
    setFilters,
    clearFilters,
    results,
    loading,
    isInitialLoading,
    isEmpty,
    error,
    loadMore,
    pageSize,
    page,
    hasMore,
    totalFetched,
    lastUpdatedAt,
    retry,
    isStale,
    minimumQueryLength,
    filtersKey,
  };
}
