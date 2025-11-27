import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCommentActions } from '../useCommentActions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Post, Comment } from '@/domain/posts';

// Mock dependencies
vi.mock('@/integrations/supabase/client');
vi.mock('@/hooks/use-toast');

const mockSupabase = supabase as any;
const mockToast = toast as any;

describe('useCommentActions', () => {
  const mockUser = {
    id: 'user-1',
    user_metadata: { display_name: 'Test User' },
  };

  const mockPost: Post = {
    id: 'post-1',
    text: 'Test post',
    author_user_id: 'user-1',
    created_at: new Date().toISOString(),
    media_urls: [],
    comments: [],
    likes_count: 0,
    is_liked: false,
    comment_count: 0,
  };

  const mockSetPost = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockReturnValue(undefined);
  });

  describe('submit', () => {
    it('requires user to be authenticated', async () => {
      const { result } = renderHook(() =>
        useCommentActions({
          post: mockPost,
          setPost: mockSetPost,
          user: null,
          profileUsername: 'testuser',
        }),
      );

      await act(async () => {
        await result.current.submit('Test comment');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Sign in required',
        description: 'Please sign in to comment.',
        variant: 'destructive',
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('requires username to be set', async () => {
      const onRequestUsername = vi.fn();

      const { result } = renderHook(() =>
        useCommentActions({
          post: mockPost,
          setPost: mockSetPost,
          user: mockUser,
          profileUsername: null,
          onRequestUsername,
        }),
      );

      await act(async () => {
        await result.current.submit('Test comment');
      });

      expect(onRequestUsername).toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('does not submit empty comments', async () => {
      const { result } = renderHook(() =>
        useCommentActions({
          post: mockPost,
          setPost: mockSetPost,
          user: mockUser,
          profileUsername: 'testuser',
        }),
      );

      await act(async () => {
        await result.current.submit('   ');
      });

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('successfully submits a comment', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'comment-1',
              created_at: new Date().toISOString(),
              client_id: 'c_test',
            },
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      const { result } = renderHook(() =>
        useCommentActions({
          post: mockPost,
          setPost: mockSetPost,
          user: mockUser,
          profileUsername: 'testuser',
        }),
      );

      await act(async () => {
        await result.current.submit('Test comment');
      });

      await waitFor(() => {
        expect(result.current.submitting).toBe(false);
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          post_id: 'post-1',
          author_user_id: 'user-1',
          text: 'Test comment',
        }),
      );
      expect(mockSetPost).toHaveBeenCalled();
    });

    it('handles API errors gracefully', async () => {
      const mockError = new Error('Database error');
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      const { result } = renderHook(() =>
        useCommentActions({
          post: mockPost,
          setPost: mockSetPost,
          user: mockUser,
          profileUsername: 'testuser',
        }),
      );

      await act(async () => {
        await result.current.submit('Test comment');
      });

      await waitFor(() => {
        expect(result.current.submitting).toBe(false);
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Database error',
        variant: 'destructive',
      });
      // Should rollback optimistic update
      expect(mockSetPost).toHaveBeenCalledTimes(2); // Once for optimistic, once for rollback
    });

    it('supports replying to comments', async () => {
      const mockReply: Comment = {
        id: 'comment-reply-1',
        text: 'Original comment',
        author_user_id: 'user-2',
        created_at: new Date().toISOString(),
        likes_count: 0,
        is_liked: false,
        post_id: 'post-1',
      };

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'comment-2',
              created_at: new Date().toISOString(),
              client_id: 'c_test',
            },
            error: null,
          }),
        }),
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      const { result } = renderHook(() =>
        useCommentActions({
          post: mockPost,
          setPost: mockSetPost,
          user: mockUser,
          profileUsername: 'testuser',
        }),
      );

      await act(async () => {
        await result.current.submit('Reply text', mockReply);
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parent_comment_id: 'comment-reply-1',
        }),
      );
    });
  });

  describe('toggleLikeComment', () => {
    it('requires user authentication', async () => {
      const { result } = renderHook(() =>
        useCommentActions({
          post: mockPost,
          setPost: mockSetPost,
          user: null,
          profileUsername: 'testuser',
        }),
      );

      await act(async () => {
        await result.current.toggleLikeComment('comment-1');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Sign in required',
        description: 'Please sign in to like comments.',
        variant: 'destructive',
      });
    });

    it('successfully toggles like on a comment', async () => {
      const postWithComment: Post = {
        ...mockPost,
        comments: [
          {
            id: 'comment-1',
            text: 'Test comment',
            author_user_id: 'user-2',
            created_at: new Date().toISOString(),
            likes_count: 0,
            is_liked: false,
            post_id: 'post-1',
          },
        ],
      };

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const { result } = renderHook(() =>
        useCommentActions({
          post: postWithComment,
          setPost: mockSetPost,
          user: mockUser,
          profileUsername: 'testuser',
        }),
      );

      await act(async () => {
        await result.current.toggleLikeComment('comment-1');
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('event_comment_reactions');
      expect(mockSetPost).toHaveBeenCalled();
    });
  });

  describe('deleteComment', () => {
    it('requires user authentication', async () => {
      const { result } = renderHook(() =>
        useCommentActions({
          post: mockPost,
          setPost: mockSetPost,
          user: null,
          profileUsername: 'testuser',
        }),
      );

      await act(async () => {
        await result.current.deleteComment('comment-1');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Sign in required',
        description: 'Please sign in to delete comments.',
        variant: 'destructive',
      });
    });

    it('only allows users to delete their own comments', async () => {
      const postWithComment: Post = {
        ...mockPost,
        comments: [
          {
            id: 'comment-1',
            text: 'Test comment',
            author_user_id: 'user-2', // Different user
            created_at: new Date().toISOString(),
            likes_count: 0,
            is_liked: false,
            post_id: 'post-1',
          },
        ],
      };

      const { result } = renderHook(() =>
        useCommentActions({
          post: postWithComment,
          setPost: mockSetPost,
          user: mockUser,
          profileUsername: 'testuser',
        }),
      );

      await act(async () => {
        await result.current.deleteComment('comment-1');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Not allowed',
        description: 'You can only delete your own comments.',
        variant: 'destructive',
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('successfully deletes a comment', async () => {
      const postWithComment: Post = {
        ...mockPost,
        comments: [
          {
            id: 'comment-1',
            text: 'Test comment',
            author_user_id: 'user-1', // Same user
            created_at: new Date().toISOString(),
            likes_count: 0,
            is_liked: false,
            post_id: 'post-1',
          },
        ],
      };

      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const { result } = renderHook(() =>
        useCommentActions({
          post: postWithComment,
          setPost: mockSetPost,
          user: mockUser,
          profileUsername: 'testuser',
        }),
      );

      await act(async () => {
        await result.current.deleteComment('comment-1');
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('event_comments');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Deleted',
        description: 'Your comment was removed.',
      });
    });
  });
});

