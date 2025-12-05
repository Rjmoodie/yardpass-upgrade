/**
 * Optimistic Cache Update Utilities
 * 
 * These functions manipulate React Query cache to provide instant UI updates
 * without waiting for server responses.
 * 
 * ⚠️ IMPORTANT: Always use with feedQueryKeys to ensure correct cache targeting.
 * 
 * @example
 * ```typescript
 * import { prependPostToFeedCache } from './optimisticUpdates';
 * import { feedQueryKeys } from './queryKeys';
 * 
 * // After post creation
 * const queryKey = feedQueryKeys.list(params);
 * prependPostToFeedCache(queryClient, queryKey, newPost);
 * ```
 */

import { QueryClient } from '@tanstack/react-query';
import type { FeedItem, FeedPage } from '@/types/api';

/**
 * Prepend a new post to the first page of feed cache
 * 
 * Used after successful post creation to show the post immediately
 * without refetching the entire feed.
 * 
 * @param queryClient - React Query client instance
 * @param queryKey - Feed query key (use feedQueryKeys.list())
 * @param newItem - The new feed item to prepend
 * 
 * @example
 * ```typescript
 * const response = await createPost(data);
 * prependPostToFeedCache(queryClient, queryKey, response.post);
 * ```
 */
export function prependPostToFeedCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  newItem: FeedItem
): void {
  queryClient.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(
    queryKey as any,
    (oldData) => {
      if (!oldData || !oldData.pages || oldData.pages.length === 0) {
        console.warn('[prependPostToFeedCache] No existing cache data, creating new page');
        return {
          pages: [{
            items: [newItem],
            nextCursor: null,
          }],
          pageParams: [undefined],
        };
      }

      // Check for duplicates (safety check)
      const firstPage = oldData.pages[0];
      const isDuplicate = firstPage.items.some(item => item.item_id === newItem.item_id);
      
      if (isDuplicate) {
        console.warn('[prependPostToFeedCache] Item already exists in cache:', newItem.item_id);
        return oldData;
      }

      // Create new first page with prepended item
      const updatedFirstPage: FeedPage = {
        ...firstPage,
        items: [newItem, ...firstPage.items],
      };

      console.log('✅ [prependPostToFeedCache] Added item to cache:', newItem.item_id);

      return {
        ...oldData,
        pages: [updatedFirstPage, ...oldData.pages.slice(1)],
      };
    }
  );
}

/**
 * Remove a post from feed cache
 * 
 * Used for rollback on post creation failure, or when user deletes a post.
 * 
 * @param queryClient - React Query client instance
 * @param queryKey - Feed query key
 * @param itemId - ID of the item to remove
 * 
 * @example
 * ```typescript
 * // On post creation error, rollback
 * removePostFromFeedCache(queryClient, queryKey, tempPostId);
 * 
 * // On post deletion
 * removePostFromFeedCache(queryClient, queryKey, deletedPostId);
 * ```
 */
export function removePostFromFeedCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  itemId: string
): void {
  queryClient.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(
    queryKey as any,
    (oldData) => {
      if (!oldData) {
        console.warn('[removePostFromFeedCache] No cache data to remove from');
        return oldData;
      }

      const pages = oldData.pages.map((page) => ({
        ...page,
        items: page.items.filter((item) => item.item_id !== itemId),
      }));

      console.log('🗑️ [removePostFromFeedCache] Removed item from cache:', itemId);

      return { ...oldData, pages };
    }
  );
}

/**
 * Update an existing post in feed cache
 * 
 * Used to update post metrics (likes, comments) or processing state.
 * 
 * @param queryClient - React Query client instance
 * @param queryKey - Feed query key
 * @param itemId - ID of the item to update
 * @param updates - Partial updates to apply
 * 
 * @example
 * ```typescript
 * // Update processing state
 * updatePostInFeedCache(queryClient, queryKey, postId, {
 *   processing: { status: 'processing', progress: 50 }
 * });
 * 
 * // Update metrics after like
 * updatePostInFeedCache(queryClient, queryKey, postId, {
 *   metrics: { ...post.metrics, likes: post.metrics.likes + 1 }
 * });
 * ```
 */
export function updatePostInFeedCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  itemId: string,
  updates: Partial<FeedItem>
): void {
  queryClient.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(
    queryKey as any,
    (oldData) => {
      if (!oldData) {
        console.warn('[updatePostInFeedCache] No cache data to update');
        return oldData;
      }

      let found = false;
      const pages = oldData.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => {
          if (item.item_id === itemId) {
            found = true;
            return { ...item, ...updates } as FeedItem;
          }
          return item;
        }),
      }));

      if (!found) {
        console.warn('[updatePostInFeedCache] Item not found in cache:', itemId);
      } else {
        console.log('✏️ [updatePostInFeedCache] Updated item in cache:', itemId);
      }

      return { ...oldData, pages };
    }
  );
}

/**
 * Replace a temporary optimistic post with the real server response
 * 
 * Used for true click-time optimistic updates (Option B in the plan).
 * Not needed for Option A (post-creation instant).
 * 
 * @param queryClient - React Query client instance
 * @param queryKey - Feed query key
 * @param tempId - Temporary ID to replace
 * @param realItem - Real item from server
 */
export function replaceOptimisticPost(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  tempId: string,
  realItem: FeedItem
): void {
  queryClient.setQueryData<{ pages: FeedPage[]; pageParams: unknown[] }>(
    queryKey as any,
    (oldData) => {
      if (!oldData) return oldData;

      const pages = oldData.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => 
          item.item_id === tempId ? realItem : item
        ),
      }));

      console.log('🔄 [replaceOptimisticPost] Replaced temp item with real:', { tempId, realId: realItem.item_id });

      return { ...oldData, pages };
    }
  );
}

/**
 * Check if an item already exists in cache
 * 
 * Useful for preventing duplicates from real-time subscriptions.
 * 
 * @param queryClient - React Query client instance
 * @param queryKey - Feed query key
 * @param itemId - ID to check
 * @returns true if item exists in cache
 */
export function isItemInCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  itemId: string
): boolean {
  const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey as any);
  
  if (!data) return false;
  
  return data.pages.some(page => 
    page.items.some(item => item.item_id === itemId)
  );
}

/**
 * Get total item count in cache
 * 
 * Useful for debugging and analytics.
 */
export function getCacheItemCount(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): number {
  const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey as any);
  
  if (!data) return 0;
  
  return data.pages.reduce((total, page) => total + page.items.length, 0);
}

