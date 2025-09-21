// src/hooks/useOptimisticReactions.ts
import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OptimisticReaction {
  postId: string;
  isLiked: boolean;
  likeCount: number;
}

interface OptimisticCommentEntry {
  postId: string;
  commentCount: number;
  newComment?: {
    id: string;
    text: string;
    author_name: string;
    created_at: string;
    /** Client-only hint; not sent to server */
    isOptimistic?: boolean;
  };
}

type ToggleResult =
  | { ok: true; isLiked: boolean; likeCount: number }
  | { ok: false; error?: string; isLiked: boolean; likeCount: number };

type AddCommentResult =
  | { success: true; comment: OptimisticCommentEntry['newComment'] }
  | { success: false; error?: string };

export const useOptimisticReactions = () => {
  const [optimisticState, setOptimisticState] = useState<Record<string, OptimisticReaction>>({});
  const [optimisticComments, setOptimisticComments] = useState<Record<string, OptimisticCommentEntry>>({});
  const { toast } = useToast();

  // Per-post guard to avoid concurrent toggles/comments racing each other
  const likeLocksRef = useRef<Record<string, boolean>>({});
  const commentLocksRef = useRef<Record<string, boolean>>({});

  /** Safely clamp non-negative */
  const clampNonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

  /**
   * Toggle like with optimistic UI and robust rollback.
   * Returns final server-truthy state when possible.
   */
  const toggleLike = async (
    postId: string,
    currentLiked: boolean,
    currentCount: number
  ): Promise<ToggleResult> => {
    if (likeLocksRef.current[postId]) {
      // Ignore if a previous toggle is still in flight
      return {
        ok: true,
        isLiked: optimisticState[postId]?.isLiked ?? currentLiked,
        likeCount: optimisticState[postId]?.likeCount ?? currentCount,
      };
    }

    likeLocksRef.current[postId] = true;

    // Compute optimistic values
    const optimisticLiked = !currentLiked;
    const optimisticCount = clampNonNegative(optimisticLiked ? currentCount + 1 : currentCount - 1);

    // Apply optimistic immediately (functional update to avoid stale closures)
    setOptimisticState((prev) => ({
      ...prev,
      [postId]: {
        postId,
        isLiked: optimisticLiked,
        likeCount: optimisticCount,
      },
    }));

    try {
      const { data, error } = await supabase.functions.invoke('reactions-toggle', {
        body: { post_id: postId, kind: 'like' },
      });

      if (error) throw error;

      // Defensive parsing of payload
      const liked = Boolean((data as any)?.liked);
      const like_count_raw = (data as any)?.like_count;
      const like_count = clampNonNegative(Number.isFinite(like_count_raw) ? like_count_raw : optimisticCount);

      // Reconcile with server truth
      setOptimisticState((prev) => ({
        ...prev,
        [postId]: {
          postId,
          isLiked: liked,
          likeCount: like_count,
        },
      }));

      return { ok: true, isLiked: liked, likeCount: like_count };
    } catch (e: any) {
      // Roll back to the previous known state
      setOptimisticState((prev) => ({
        ...prev,
        [postId]: {
          postId,
          isLiked: currentLiked,
          likeCount: clampNonNegative(currentCount),
        },
      }));

      const msg = e?.message ?? 'Failed to update reaction';
      toast({ title: 'Error', description: msg, variant: 'destructive' });

      return { ok: false, error: msg, isLiked: currentLiked, likeCount: clampNonNegative(currentCount) };
    } finally {
      likeLocksRef.current[postId] = false;
    }
  };

  /**
   * Add a comment with optimistic UI.
   * Keeps a temporary comment until the server confirms/denies.
   */
  const addComment = async (
    postId: string,
    commentText: string,
    currentCount: number
  ): Promise<AddCommentResult> => {
    const text = commentText?.trim();
    if (!text) {
      toast({ title: 'Empty comment', description: 'Please enter a comment', variant: 'destructive' });
      return { success: false, error: 'empty' };
    }

    if (commentLocksRef.current[postId]) {
      // Already adding a comment for this post; prevent spam
      return { success: false, error: 'in_flight' };
    }
    commentLocksRef.current[postId] = true;

    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        toast({ title: 'Authentication required', description: 'Please sign in to comment', variant: 'destructive' });
        return { success: false, error: 'unauthenticated' };
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticComment = {
        id: tempId,
        text,
        author_name: user.user_metadata?.display_name || 'You',
        created_at: new Date().toISOString(),
        isOptimistic: true,
      };

      // Optimistic +1 and show temp comment
      setOptimisticComments((prev) => ({
        ...prev,
        [postId]: {
          postId,
          commentCount: clampNonNegative(currentCount + 1),
          newComment: optimisticComment,
        },
      }));

      // Fire request
      const { data, error } = await supabase.functions.invoke('comments-add', {
        body: { post_id: postId, text },
      });

      if (error) {
        // Roll back count and remove temp comment
        setOptimisticComments((prev) => ({
          ...prev,
          [postId]: {
            postId,
            commentCount: clampNonNegative(currentCount),
            newComment: undefined,
          },
        }));
        const msg = error?.message ?? 'Failed to add comment';
        toast({ title: 'Error', description: msg, variant: 'destructive' });
        return { success: false, error: msg };
      }

      // Defensive read of response
      const serverComment = (data as any)?.comment;
      const serverCount = (data as any)?.comment_count;

      const finalComment = {
        id: String(serverComment?.id ?? optimisticComment.id),
        text: String(serverComment?.text ?? optimisticComment.text),
        author_name:
          String(serverComment?.author_name) ||
          user.user_metadata?.display_name ||
          'You',
        created_at: String(serverComment?.created_at ?? optimisticComment.created_at),
        isOptimistic: false,
      };

      setOptimisticComments((prev) => ({
        ...prev,
        [postId]: {
          postId,
          commentCount: clampNonNegative(
            Number.isFinite(serverCount) ? serverCount : currentCount + 1
          ),
          newComment: finalComment,
        },
      }));

      return { success: true, comment: finalComment };
    } catch (e: any) {
      // Roll back on unexpected error
      setOptimisticComments((prev) => ({
        ...prev,
        [postId]: {
          postId,
          commentCount: clampNonNegative(currentCount),
          newComment: undefined,
        },
      }));
      const msg = e?.message ?? 'Failed to add comment';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      return { success: false, error: msg };
    } finally {
      commentLocksRef.current[postId] = false;
    }
  };

  /** Get optimistic like data or provided fallback */
  const getOptimisticData = (
    postId: string,
    fallback: { isLiked: boolean; likeCount: number }
  ) => optimisticState[postId] || { postId, ...fallback };

  /** Get optimistic comment data or provided fallback */
  const getOptimisticCommentData = (
    postId: string,
    fallback: { commentCount: number }
  ) =>
    optimisticComments[postId] || {
      postId,
      commentCount: clampNonNegative(fallback.commentCount),
    };

  return {
    toggleLike,
    addComment,
    getOptimisticData,
    getOptimisticCommentData,
  };
};
