/**
 * Centralized Query Key Factory for Feed
 * 
 * ⚠️ IMPORTANT: Always use these factories instead of constructing keys manually.
 * This ensures cache mutations work correctly across the application.
 * 
 * @example
 * ```typescript
 * import { feedQueryKeys } from './queryKeys';
 * 
 * // In useUnifiedFeedInfinite
 * const queryKey = feedQueryKeys.list({ limit: 30, locations: ['NYC'] });
 * 
 * // In optimistic updates
 * prependPostToFeedCache(queryClient, queryKey, newPost);
 * ```
 */

import type { QueryClient } from '@tanstack/react-query';

export interface UnifiedFeedParams {
  limit?: number;
  locations?: string[];
  categories?: string[];
  dates?: string[];
  searchRadius?: number;
}

/**
 * Centralized query key factory for unified feed.
 * 
 * Hierarchy:
 * - ['unifiedFeed'] - All feed queries
 * - ['unifiedFeed', 'list'] - All list queries
 * - ['unifiedFeed', 'list', params] - Specific list with filters
 * - ['unifiedFeed', 'post', postId] - Single post
 */
export const feedQueryKeys = {
  /**
   * Base key for all feed-related queries
   */
  all: ['unifiedFeed'] as const,
  
  /**
   * All list queries (without specific params)
   */
  lists: () => [...feedQueryKeys.all, 'list'] as const,
  
  /**
   * Specific list query with filters
   * This is what you'll use most often
   */
  list: (params: UnifiedFeedParams) => 
    [...feedQueryKeys.lists(), normalizeParams(params)] as const,
  
  /**
   * Single post query
   */
  post: (postId: string) => 
    [...feedQueryKeys.all, 'post', postId] as const,
  
  /**
   * Legacy EventFeed key (for migration)
   * @deprecated Use list() with event filter instead
   */
  eventFeed: (eventId: string) => 
    ['eventFeed', eventId] as const,
};

/**
 * Normalize params to ensure consistent cache keys.
 * 
 * This is critical because:
 * - Empty array [] !== undefined
 * - Order matters for array comparison
 * - Missing fields should have default values
 * 
 * @example
 * ```typescript
 * normalizeParams({ locations: [] })
 * // Returns: { limit: 30, locations: [], categories: [], dates: [] }
 * 
 * normalizeParams({ limit: 20, categories: ['Music', 'Sports'] })
 * // Returns: { limit: 20, locations: [], categories: ['Music', 'Sports'], dates: [] }
 * ```
 */
export function normalizeParams(params: UnifiedFeedParams): UnifiedFeedParams {
  return {
    limit: params.limit ?? 30,
    locations: params.locations ?? [],
    categories: params.categories ?? [],
    dates: params.dates ?? [],
    searchRadius: params.searchRadius,
  };
}

/**
 * Helper to invalidate all feed queries
 * Useful after major data changes (e.g., user follows new event)
 */
export function invalidateAllFeeds(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: feedQueryKeys.all });
}

/**
 * Helper to check if a query key is a feed query
 */
export function isFeedQueryKey(queryKey: unknown[]): boolean {
  return Array.isArray(queryKey) && queryKey[0] === 'unifiedFeed';
}

