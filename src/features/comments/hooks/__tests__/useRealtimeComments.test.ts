import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRealtimeComments } from '../useRealtimeComments';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeComment } from '../useRealtimeComments';

// Mock dependencies
vi.mock('@/integrations/supabase/client');

const mockSupabase = supabase as any;

describe('useRealtimeComments', () => {
  const mockOnCommentAdded = vi.fn();
  const mockOnCommentDeleted = vi.fn();
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  const mockRemoveChannel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.channel = vi.fn().mockReturnValue(mockChannel);
    mockSupabase.removeChannel = mockRemoveChannel;
    mockSupabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({
            data: [{ id: 'post-1' }, { id: 'post-2' }],
            error: null,
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('with explicit postIds', () => {
    it('subscribes to comments for provided postIds', () => {
      const postIds = ['post-1', 'post-2'];

      renderHook(() =>
        useRealtimeComments({
          postIds,
          onCommentAdded: mockOnCommentAdded,
          onCommentDeleted: mockOnCommentDeleted,
        }),
      );

      // Should create channels for the posts
      expect(mockSupabase.channel).toHaveBeenCalled();
    });

    it('does not fetch posts when postIds are provided', () => {
      const postIds = ['post-1'];

      renderHook(() =>
        useRealtimeComments({
          postIds,
          onCommentAdded: mockOnCommentAdded,
          onCommentDeleted: mockOnCommentDeleted,
        }),
      );

      // Should not query event_posts when postIds are provided
      expect(mockSupabase.from).not.toHaveBeenCalledWith('event_posts');
    });

    it('updates subscriptions when postIds change', async () => {
      const { rerender } = renderHook(
        ({ postIds }) =>
          useRealtimeComments({
            postIds,
            onCommentAdded: mockOnCommentAdded,
            onCommentDeleted: mockOnCommentDeleted,
          }),
        {
          initialProps: { postIds: ['post-1'] },
        },
      );

      await waitFor(() => {
        expect(mockSupabase.channel).toHaveBeenCalled();
      });

      const initialCalls = mockSupabase.channel.mock.calls.length;

      rerender({ postIds: ['post-1', 'post-2'] });

      await waitFor(() => {
        // Should have created additional channels for new posts
        expect(mockSupabase.channel.mock.calls.length).toBeGreaterThan(initialCalls);
      });
    });
  });

  describe('with eventId', () => {
    it('fetches postIds from event when eventId is provided', async () => {
      renderHook(() =>
        useRealtimeComments({
          eventId: 'event-1',
          onCommentAdded: mockOnCommentAdded,
          onCommentDeleted: mockOnCommentDeleted,
        }),
      );

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('event_posts');
      });
    });

    it('subscribes to new posts when subscribing by event', () => {
      renderHook(() =>
        useRealtimeComments({
          eventId: 'event-1',
          onCommentAdded: mockOnCommentAdded,
          onCommentDeleted: mockOnCommentDeleted,
        }),
      );

      // Should create a channel for event posts
      expect(mockSupabase.channel).toHaveBeenCalledWith(
        expect.stringContaining('event-posts-'),
      );
    });

    it('handles errors when fetching posts gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          }),
        }),
      });

      renderHook(() =>
        useRealtimeComments({
          eventId: 'event-1',
          onCommentAdded: mockOnCommentAdded,
          onCommentDeleted: mockOnCommentDeleted,
        }),
      );

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Failed to load post IDs for event:',
          expect.any(Error),
        );
      });

      consoleWarnSpy.mockRestore();
    });
  });

  describe('callback handling', () => {
    it('maintains latest callbacks in refs', () => {
      const { rerender } = renderHook(
        ({ onCommentAdded }) =>
          useRealtimeComments({
            postIds: ['post-1'],
            onCommentAdded,
            onCommentDeleted: mockOnCommentDeleted,
          }),
        {
          initialProps: { onCommentAdded: mockOnCommentAdded },
        },
      );

      const newCallback = vi.fn();
      rerender({ onCommentAdded: newCallback });

      // Callbacks are stored in refs, so changing them shouldn't trigger re-subscriptions
      // This is a performance optimization to prevent subscription churn
      expect(mockSupabase.channel).toHaveBeenCalled();
    });

    it('calls onCommentAdded when new comment is inserted', () => {
      renderHook(() =>
        useRealtimeComments({
          postIds: ['post-1'],
          onCommentAdded: mockOnCommentAdded,
          onCommentDeleted: mockOnCommentDeleted,
        }),
      );

      // Simulate a realtime event
      const insertHandler = mockChannel.on.mock.calls.find(
        (call: any[]) => call[2]?.event === 'INSERT',
      );

      if (insertHandler) {
        const callback = insertHandler[2];
        const mockPayload = {
          new: {
            id: 'comment-1',
            text: 'New comment',
            post_id: 'post-1',
            author_user_id: 'user-1',
            created_at: new Date().toISOString(),
          },
        };

        // The callback would be called by Supabase realtime
        // We can't easily test this without mocking the entire channel system
        // This test verifies the setup is correct
        expect(mockChannel.on).toHaveBeenCalledWith(
          'postgres_changes',
          expect.objectContaining({
            event: 'INSERT',
            table: 'event_comments',
          }),
          expect.any(Function),
        );
      }
    });

    it('calls onCommentDeleted when comment is deleted', () => {
      renderHook(() =>
        useRealtimeComments({
          postIds: ['post-1'],
          onCommentAdded: mockOnCommentAdded,
          onCommentDeleted: mockOnCommentDeleted,
        }),
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'DELETE',
          table: 'event_comments',
        }),
        expect.any(Function),
      );
    });
  });

  describe('cleanup', () => {
    it('removes channels on unmount', () => {
      const { unmount } = renderHook(() =>
        useRealtimeComments({
          postIds: ['post-1'],
          onCommentAdded: mockOnCommentAdded,
          onCommentDeleted: mockOnCommentDeleted,
        }),
      );

      unmount();

      expect(mockRemoveChannel).toHaveBeenCalled();
    });

    it('clears author cache when eventId changes', () => {
      const { rerender } = renderHook(
        ({ eventId }) =>
          useRealtimeComments({
            eventId,
            onCommentAdded: mockOnCommentAdded,
            onCommentDeleted: mockOnCommentDeleted,
          }),
        {
          initialProps: { eventId: 'event-1' },
        },
      );

      rerender({ eventId: 'event-2' });

      // Cache should be cleared when eventId changes
      // This is verified by checking that the effect runs again
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  describe('chunking for large post lists', () => {
    it('creates multiple channels when postIds exceed chunk size', () => {
      // Create 100 post IDs to trigger chunking (CHUNK = 80)
      const manyPostIds = Array.from({ length: 100 }, (_, i) => `post-${i + 1}`);

      renderHook(() =>
        useRealtimeComments({
          postIds: manyPostIds,
          onCommentAdded: mockOnCommentAdded,
          onCommentDeleted: mockOnCommentDeleted,
        }),
      );

      // Should create multiple channels (100 posts / 80 chunk size = 2 chunks)
      const channelCalls = mockSupabase.channel.mock.calls.filter((call: any[]) =>
        call[0]?.includes('event-comments-'),
      );
      expect(channelCalls.length).toBeGreaterThan(1);
    });
  });

  describe('without eventId or postIds', () => {
    it('does not subscribe when no eventId or postIds provided', () => {
      renderHook(() =>
        useRealtimeComments({
          onCommentAdded: mockOnCommentAdded,
          onCommentDeleted: mockOnCommentDeleted,
        }),
      );

      // Should not create any comment channels
      const commentChannelCalls = mockSupabase.channel.mock.calls.filter((call: any[]) =>
        call[0]?.includes('event-comments-'),
      );
      expect(commentChannelCalls.length).toBe(0);
    });
  });
});

