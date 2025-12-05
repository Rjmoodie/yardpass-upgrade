/**
 * Unit tests for optimistic cache update utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  prependPostToFeedCache,
  removePostFromFeedCache,
  updatePostInFeedCache,
  replaceOptimisticPost,
  isItemInCache,
  getCacheItemCount,
} from '../optimisticUpdates';
import type { FeedItem, FeedItemPost, FeedPage } from '@/types/api';

describe('optimisticUpdates', () => {
  let queryClient: QueryClient;
  const queryKey = ['unifiedFeed', 'list', { limit: 30 }];

  // Mock post factory
  const createMockPost = (id: string, timestamp = Date.now()): FeedItemPost => ({
    item_type: 'post',
    item_id: id,
    event_id: 'event-1',
    created_at_ts: timestamp,
    author: {
      id: 'user-1',
      display_name: 'Test User',
      username: 'testuser',
      photo_url: null,
    },
    content: {
      text: `Test post ${id}`,
      media: [],
    },
    metrics: {
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      viewer_has_liked: false,
    },
    event: null,
  });

  // Mock initial cache data
  const createInitialCache = () => ({
    pages: [
      {
        items: [
          createMockPost('post-1', 1000),
          createMockPost('post-2', 900),
        ],
        nextCursor: { cursorTs: 900, cursorId: 'post-2' },
      },
    ],
    pageParams: [undefined],
  });

  beforeEach(() => {
    // Create fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
      logger: {
        log: () => {},
        warn: () => {},
        error: () => {},
      },
    });
  });

  describe('prependPostToFeedCache', () => {
    it('should prepend a new post to the first page', () => {
      // Setup: Set initial cache
      queryClient.setQueryData(queryKey, createInitialCache());

      // Action: Prepend new post
      const newPost = createMockPost('post-3', 1100);
      prependPostToFeedCache(queryClient, queryKey, newPost);

      // Assert: New post should be first
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      expect(data?.pages[0].items).toHaveLength(3);
      expect(data?.pages[0].items[0].item_id).toBe('post-3');
      expect(data?.pages[0].items[1].item_id).toBe('post-1');
      expect(data?.pages[0].items[2].item_id).toBe('post-2');
    });

    it('should create initial cache if none exists', () => {
      // Action: Prepend to empty cache
      const newPost = createMockPost('post-1', 1000);
      prependPostToFeedCache(queryClient, queryKey, newPost);

      // Assert: Cache should be created with one item
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      expect(data?.pages).toHaveLength(1);
      expect(data?.pages[0].items).toHaveLength(1);
      expect(data?.pages[0].items[0].item_id).toBe('post-1');
    });

    it('should not add duplicate posts', () => {
      // Setup: Set initial cache
      queryClient.setQueryData(queryKey, createInitialCache());

      // Action: Try to prepend duplicate
      const duplicate = createMockPost('post-1', 1100);
      prependPostToFeedCache(queryClient, queryKey, duplicate);

      // Assert: Should still have 2 items (no duplicate)
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      expect(data?.pages[0].items).toHaveLength(2);
    });

    it('should preserve other pages', () => {
      // Setup: Create cache with multiple pages
      const multiPageCache = {
        pages: [
          createInitialCache().pages[0],
          {
            items: [createMockPost('post-3', 800)],
            nextCursor: null,
          },
        ],
        pageParams: [undefined, { cursorTs: 900, cursorId: 'post-2' }],
      };
      queryClient.setQueryData(queryKey, multiPageCache);

      // Action: Prepend to first page
      const newPost = createMockPost('post-4', 1100);
      prependPostToFeedCache(queryClient, queryKey, newPost);

      // Assert: Second page should be unchanged
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      expect(data?.pages).toHaveLength(2);
      expect(data?.pages[1].items[0].item_id).toBe('post-3');
    });
  });

  describe('removePostFromFeedCache', () => {
    it('should remove a post from cache', () => {
      // Setup
      queryClient.setQueryData(queryKey, createInitialCache());

      // Action: Remove post-1
      removePostFromFeedCache(queryClient, queryKey, 'post-1');

      // Assert: Only post-2 should remain
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      expect(data?.pages[0].items).toHaveLength(1);
      expect(data?.pages[0].items[0].item_id).toBe('post-2');
    });

    it('should handle removing non-existent post gracefully', () => {
      // Setup
      queryClient.setQueryData(queryKey, createInitialCache());

      // Action: Remove non-existent post
      removePostFromFeedCache(queryClient, queryKey, 'post-999');

      // Assert: Original items should remain
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      expect(data?.pages[0].items).toHaveLength(2);
    });

    it('should handle empty cache gracefully', () => {
      // Action: Remove from empty cache
      removePostFromFeedCache(queryClient, queryKey, 'post-1');

      // Assert: Should not crash
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      expect(data).toBeUndefined();
    });
  });

  describe('updatePostInFeedCache', () => {
    it('should update post metrics', () => {
      // Setup
      queryClient.setQueryData(queryKey, createInitialCache());

      // Action: Update like count
      updatePostInFeedCache(queryClient, queryKey, 'post-1', {
        metrics: {
          likes: 5,
          comments: 0,
          shares: 0,
          views: 0,
          viewer_has_liked: true,
        },
      } as Partial<FeedItem>);

      // Assert: Metrics should be updated
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      const updatedPost = data?.pages[0].items[0] as FeedItemPost;
      expect(updatedPost.metrics.likes).toBe(5);
      expect(updatedPost.metrics.viewer_has_liked).toBe(true);
    });

    it('should update processing state', () => {
      // Setup
      queryClient.setQueryData(queryKey, createInitialCache());

      // Action: Update processing state
      updatePostInFeedCache(queryClient, queryKey, 'post-1', {
        processing: {
          status: 'processing',
          progress: 50,
        },
      } as Partial<FeedItem>);

      // Assert: Processing state should be updated
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      const updatedPost = data?.pages[0].items[0] as FeedItemPost;
      expect(updatedPost.processing?.status).toBe('processing');
      expect(updatedPost.processing?.progress).toBe(50);
    });

    it('should handle updating non-existent post gracefully', () => {
      // Setup
      queryClient.setQueryData(queryKey, createInitialCache());

      // Action: Update non-existent post
      updatePostInFeedCache(queryClient, queryKey, 'post-999', {
        metrics: { likes: 5, comments: 0, shares: 0, views: 0, viewer_has_liked: true },
      } as Partial<FeedItem>);

      // Assert: Original data should remain unchanged
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      expect(data?.pages[0].items).toHaveLength(2);
    });
  });

  describe('replaceOptimisticPost', () => {
    it('should replace temporary post with real post', () => {
      // Setup: Add temp post to cache
      const tempPost = { ...createMockPost('temp-123'), isOptimistic: true };
      queryClient.setQueryData(queryKey, {
        pages: [{
          items: [tempPost, createMockPost('post-1')],
          nextCursor: null,
        }],
        pageParams: [undefined],
      });

      // Action: Replace with real post
      const realPost = createMockPost('post-real-456');
      replaceOptimisticPost(queryClient, queryKey, 'temp-123', realPost);

      // Assert: Temp post should be replaced
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      expect(data?.pages[0].items).toHaveLength(2);
      expect(data?.pages[0].items[0].item_id).toBe('post-real-456');
      expect((data?.pages[0].items[0] as any).isOptimistic).toBeUndefined();
    });
  });

  describe('isItemInCache', () => {
    it('should return true if item exists', () => {
      // Setup
      queryClient.setQueryData(queryKey, createInitialCache());

      // Assert
      expect(isItemInCache(queryClient, queryKey, 'post-1')).toBe(true);
      expect(isItemInCache(queryClient, queryKey, 'post-2')).toBe(true);
    });

    it('should return false if item does not exist', () => {
      // Setup
      queryClient.setQueryData(queryKey, createInitialCache());

      // Assert
      expect(isItemInCache(queryClient, queryKey, 'post-999')).toBe(false);
    });

    it('should return false if cache is empty', () => {
      // Assert
      expect(isItemInCache(queryClient, queryKey, 'post-1')).toBe(false);
    });
  });

  describe('getCacheItemCount', () => {
    it('should return total item count across all pages', () => {
      // Setup: Multiple pages
      const multiPageCache = {
        pages: [
          { items: [createMockPost('post-1'), createMockPost('post-2')], nextCursor: { cursorTs: 900, cursorId: 'post-2' } },
          { items: [createMockPost('post-3')], nextCursor: null },
        ],
        pageParams: [undefined, { cursorTs: 900, cursorId: 'post-2' }],
      };
      queryClient.setQueryData(queryKey, multiPageCache);

      // Assert: Should count across all pages
      expect(getCacheItemCount(queryClient, queryKey)).toBe(3);
    });

    it('should return 0 for empty cache', () => {
      // Assert
      expect(getCacheItemCount(queryClient, queryKey)).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should handle large caches efficiently', () => {
      // Setup: Create cache with 1000 items
      const largeCache = {
        pages: [{
          items: Array.from({ length: 1000 }, (_, i) => createMockPost(`post-${i}`)),
          nextCursor: null,
        }],
        pageParams: [undefined],
      };
      queryClient.setQueryData(queryKey, largeCache);

      // Measure prepend performance
      const start = performance.now();
      prependPostToFeedCache(queryClient, queryKey, createMockPost('new-post'));
      const end = performance.now();

      // Assert: Should complete in < 10ms
      expect(end - start).toBeLessThan(10);

      // Verify result
      const data = queryClient.getQueryData<{ pages: FeedPage[] }>(queryKey);
      expect(data?.pages[0].items).toHaveLength(1001);
      expect(data?.pages[0].items[0].item_id).toBe('new-post');
    });
  });
});

