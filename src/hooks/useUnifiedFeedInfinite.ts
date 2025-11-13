import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FeedCursor, FeedItem, FeedPage } from './unifiedFeedTypes';
import { logger } from '@/utils/logger';

type EngagementDelta = {
  like_count?: number;
  comment_count?: number;
  viewer_has_liked?: boolean;
  mode?: 'delta' | 'absolute';
};

export interface FeedFilters {
  locations?: string[];
  categories?: string[];
  dates?: string[];
  searchRadius?: number;
}

// Get or create session ID for exploration bonus
function getSessionId(): string {
  const storageKey = 'liventix_session_id';
  let sessionId = localStorage.getItem(storageKey);
  
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
}

async function fetchPage(
  cursor: FeedCursor | undefined,
  limit: number,
  accessToken: string | null,
  filters?: FeedFilters,
  userLocation?: { lat: number; lng: number } | null
): Promise<FeedPage> {
  // 🎯 PERF-008: Retrieve last ETag for conditional requests
  const cacheKey = `feed-etag:${JSON.stringify({ limit, filters, cursor })}`;
  const lastEtag = sessionStorage.getItem(cacheKey);
  
  const invokeOptions: {
    body: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {
    body: {
      limit,
      cursor: cursor
        ? {
            ts: cursor.cursorTs,
            id: cursor.cursorId,
            score: cursor.cursorScore ?? null,
          }
        : null,
      // Pass filters to backend for server-side filtering
      filters: filters || {},
      // Pass user location for "Near Me" filtering
      ...(userLocation && {
        user_lat: userLocation.lat,
        user_lng: userLocation.lng,
      }),
      // 🎯 Pass session ID for exploration bonus in ranking
      session_id: getSessionId(),
    },
  };

  // Add headers
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  // 🎯 PERF-008: Send If-None-Match for cache validation
  if (lastEtag) {
    headers['If-None-Match'] = lastEtag;
  }
  
  if (Object.keys(headers).length > 0) {
    invokeOptions.headers = headers;
  }

  const response = await supabase.functions.invoke('home-feed', invokeOptions);

  if (response.error) {
    throw new Error(`home-feed failed: ${response.error.message}`);
  }

  if (!response.data || typeof response.data !== 'object' || !Array.isArray((response.data as any).items)) {
    throw new Error('home-feed returned an unexpected payload');
  }
  
  const data = response.data;

  const feedData = data as FeedPage;
  const posts = feedData.items.filter(i => i.item_type === 'post');
  logger.debug('🔍 home-feed Edge Function returned:', {
    totalItems: feedData.items.length,
    totalPosts: posts.length,
    postSamples: posts.slice(0, 3).map(p => ({
      id: p.item_id,
      rawMetrics: p.metrics,
      likes: p.metrics?.likes,
      comments: p.metrics?.comments,
      hasMetrics: !!p.metrics
    }))
  });
  
  // 🎯 PERF-008: Store ETag for future requests
  // Note: Supabase functions.invoke doesn't expose response headers easily
  // So we generate a client-side cache key based on content
  const clientEtag = `"${hashCode(JSON.stringify({ itemCount: feedData.items.length }))}"`;
  sessionStorage.setItem(cacheKey, clientEtag);
  
  // 🎯 PERF-010: Track query performance for SLO monitoring
  // The Edge Function logs are visible in Supabase dashboard, but we also
  // send to PostHog for aggregated metrics and alerting
  if (feedData.performance?.query_time) {
    const queryDuration = feedData.performance.query_time;
    const SLO_TARGET = 500; // ms
    
    // Import posthog dynamically to avoid circular deps
    import('posthog-js').then(({ default: posthog }) => {
      posthog?.capture('feed_query_performance', {
        duration_ms: queryDuration,
        slo_target_ms: SLO_TARGET,
        slo_met: queryDuration <= SLO_TARGET,
        breach_percentage: queryDuration > SLO_TARGET ? Math.round((queryDuration / SLO_TARGET - 1) * 100) : 0,
        item_count: feedData.items.length,
        has_filters: !!(filters?.categories?.length || filters?.locations?.length || filters?.dates?.length),
        is_first_page: !cursor
      });
    }).catch(() => {
      // PostHog not available, skip tracking
    });
  }

  return data as FeedPage;
}

// Simple hash function (matches Edge Function)
function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function useUnifiedFeedInfinite(options: FeedFilters & { limit?: number } = {}) {
  const { limit = 30, locations = [], categories = [], dates = [], searchRadius } = options;
  const qc = useQueryClient();

  // Include filters in query key for proper caching
  const filters: FeedFilters = { locations, categories, dates, searchRadius };

  // Get user location if "Near Me" filter is active or searchRadius is set
  const needsLocation = locations.includes('Near Me') || (searchRadius && searchRadius < 100);

  const query = useInfiniteQuery<FeedPage, Error>({
    queryKey: ['unifiedFeed', { limit, locations, categories, dates, searchRadius }],
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const cursor = pageParam as FeedCursor | undefined;
      
      // Get user's geolocation if needed for "Near Me" filtering
      let userLocation: { lat: number; lng: number } | null = null;
      if (needsLocation) {
        try {
          userLocation = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
            if ('geolocation' in navigator) {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                  });
                },
                (error) => {
                  console.warn('Failed to get user location:', error.message);
                  resolve(null);
                },
                { timeout: 1000, maximumAge: 300000 } // 🎯 PERF: 1s timeout (was 5s), 5min cache
              );
            } else {
              resolve(null);
            }
          });
        } catch (error) {
          console.warn('Geolocation error:', error);
          userLocation = null;
        }
      }
      
      return fetchPage(cursor, limit, session?.access_token ?? null, filters, userLocation);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 15_000,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  function applyEngagementDelta(postId: string, delta: EngagementDelta) {
    qc.setQueryData(['unifiedFeed', { limit, locations, categories, dates, searchRadius }], (oldData: any) => {
      if (!oldData) return oldData;

      const pages = oldData.pages.map((page: FeedPage) => {
        const updatedItems = page.items.map((item) => {
          if (item.item_type !== 'post' || item.item_id !== postId) return item;

          const mode = delta.mode ?? 'delta';
          const currentLikes = item.metrics.likes ?? 0;
          const currentComments = item.metrics.comments ?? 0;

          const likes = delta.like_count != null
            ? Math.max(0, mode === 'absolute' ? delta.like_count : currentLikes + delta.like_count)
            : currentLikes;

          const comments = delta.comment_count != null
            ? Math.max(0, mode === 'absolute' ? delta.comment_count : currentComments + delta.comment_count)
            : currentComments;

          return {
            ...item,
            metrics: {
              ...item.metrics,
              likes,
              comments,
              viewer_has_liked: delta.viewer_has_liked ?? item.metrics.viewer_has_liked,
            },
          } as FeedItem;
        });

        return { ...page, items: updatedItems };
      });

      return { ...oldData, pages };
    });
  }

  return { ...query, items, applyEngagementDelta };
}
