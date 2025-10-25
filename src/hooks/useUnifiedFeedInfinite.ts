import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FeedCursor, FeedItem, FeedPage } from './unifiedFeedTypes';

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

async function fetchPage(
  cursor: FeedCursor | undefined,
  limit: number,
  accessToken: string | null,
  filters?: FeedFilters,
  userLocation?: { lat: number; lng: number } | null
): Promise<FeedPage> {
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
    },
  };

  if (accessToken) {
    invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };
  }

  const { data, error } = await supabase.functions.invoke('home-feed', invokeOptions);

  if (error) {
    throw new Error(`home-feed failed: ${error.message}`);
  }

  if (!data || typeof data !== 'object' || !Array.isArray((data as any).items)) {
    throw new Error('home-feed returned an unexpected payload');
  }

  // 🔍 Debug: Log what home-feed is returning
  const feedData = data as FeedPage;
  const posts = feedData.items.filter(i => i.item_type === 'post');
  console.log('🔍 home-feed Edge Function returned:', {
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

  return data as FeedPage;
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
                { timeout: 5000, maximumAge: 300000 } // 5min cache
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
