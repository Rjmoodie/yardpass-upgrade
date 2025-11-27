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
    // Enhanced error logging for iOS debugging
    const errorDetails = {
      message: error.message,
      name: error.name,
      status: (error as any).status,
      context: (error as any).context,
      stack: error instanceof Error ? error.stack : undefined,
    };
    
    console.error('❌ [Feed] home-feed error:', errorDetails);
    
    // Log to console for iOS debugging
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      console.error('[iOS Debug] Feed error details:', JSON.stringify(errorDetails, null, 2));
    }
    
    // Provide more helpful error message
    const errorMessage = error.message || 'Unknown error';
    const statusCode = (error as any).status;
    
    if (statusCode === 403) {
      throw new Error('Access denied. Please check your connection and try again.');
    } else if (statusCode === 500) {
      throw new Error('Server error. Please try again in a moment.');
    } else {
      throw new Error(`Failed to load feed: ${errorMessage}`);
    }
  }

  if (!data || typeof data !== 'object' || !Array.isArray((data as any).items)) {
    console.error('❌ [Feed] Invalid response format:', { data });
    throw new Error('home-feed returned an unexpected payload');
  }

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
      // Get session with better error handling for iOS
      let session;
      try {
        const sessionResult = await supabase.auth.getSession();
        session = sessionResult.data?.session ?? null;
        
        if (!session) {
          logger.warn('⚠️ [Feed] No active session - feed may be limited');
        }
      } catch (error: any) {
        console.error('❌ [Feed] Session error:', error);
        // Continue without session - some feed items may still load
        session = null;
      }
      
      const cursor = pageParam as FeedCursor | undefined;
      
      logger.debug('🔍 [useUnifiedFeedInfinite] Fetching with filters:', {
        locations,
        categories,
        dates,
        searchRadius,
        cursor: cursor ? `${cursor.cursorId?.substring(0, 8)}...` : 'first page'
      });
      
      // Get user's geolocation if needed for "Near Me" filtering
      let userLocation: { lat: number; lng: number } | null = null;
      if (needsLocation) {
        try {
          // Use Capacitor Geolocation on native platforms (prevents "localhost" in permission dialog)
          const { Capacitor } = await import('@capacitor/core');
          const { Geolocation } = await import('@capacitor/geolocation');
          
          if (Capacitor.isNativePlatform()) {
            try {
              const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 300000, // 5min cache
              });
              userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
            } catch (error: any) {
              logger.warn('Native geolocation failed:', error.message);
              userLocation = null;
            }
          } else {
            // Fallback to browser API for web
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
                    logger.warn('Failed to get user location:', error.message);
                    resolve(null);
                  },
                  { timeout: 1000, maximumAge: 300000 }
                );
              } else {
                resolve(null);
              }
            });
          }
        } catch (error) {
          logger.warn('Geolocation error:', error);
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
