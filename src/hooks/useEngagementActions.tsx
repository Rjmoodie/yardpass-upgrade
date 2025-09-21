// src/hooks/useEngagementActions.ts
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export interface EngagementState {
  isLiked: boolean;
  likeCount: number;
  commentCount: number;
}

interface HandleCommentOptions {
  /** Optional callback to open a modal (preferred, avoids navigation). */
  openCommentModal?: () => void;
  /** Selector to focus an input if present on the page. Defaults to '#comment-input'. */
  focusSelector?: string;
  /** Hash to append if navigating to the event page (e.g. '#comments'). Defaults to '#comments'. */
  navigateHash?: string;
}

export const useEngagementActions = (
  postId: string,
  eventId: string,
  initialState: EngagementState
) => {
  const navigate = useNavigate();
  const { toggleLike, addComment, getOptimisticData, getOptimisticCommentData } =
    useOptimisticReactions();
  const { requireAuth } = useAuthGuard();

  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  // Prevent state updates after unmount during async work
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Current optimistic states with sane fallbacks
  const currentLikeState = useMemo(
    () =>
      getOptimisticData(postId, {
        isLiked: initialState.isLiked,
        likeCount: initialState.likeCount,
      }),
    [getOptimisticData, postId, initialState.isLiked, initialState.likeCount]
  );

  const currentCommentState = useMemo(
    () =>
      getOptimisticCommentData(postId, {
        commentCount: initialState.commentCount,
      }),
    [getOptimisticCommentData, postId, initialState.commentCount]
  );

  const shareUrl = useMemo(() => {
    try {
      const base = `${window.location.origin}/event/${eventId}`;
      return base;
    } catch {
      // SSR safety
      return `/event/${eventId}`;
    }
  }, [eventId]);

  const handleLike = useCallback(() => {
    requireAuth(
      () => {
        toggleLike(
          postId,
          currentLikeState.isLiked,
          currentLikeState.likeCount
        );
      },
      'Please sign in to like posts'
    );
  }, [requireAuth, toggleLike, postId, currentLikeState.isLiked, currentLikeState.likeCount]);

  const handleComment = useCallback(
    (opts?: HandleCommentOptions) => {
      const {
        openCommentModal,
        focusSelector = '#comment-input',
        navigateHash = '#comments',
      } = opts || {};

      requireAuth(
        () => {
          if (openCommentModal) {
            openCommentModal();
            return;
          }

          // Try to focus an input on the current page
          const el = (typeof document !== 'undefined'
            ? (document.querySelector(focusSelector) as HTMLInputElement | null)
            : null);

          if (el) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            // Fallback: navigate to the event page's comments section
            navigate(`/event/${eventId}${navigateHash}`);
          }
        },
        'Please sign in to comment'
      );
    },
    [requireAuth, navigate, eventId]
  );

  const submitComment = useCallback(async (): Promise<boolean> => {
    const text = commentText.trim();
    if (!text) return false;

    let ok = false;
    await new Promise<void>((resolve) => {
      // Ensure user is authenticated before attempting submit
      requireAuth(async () => {
        setIsCommenting(true);
        try {
          const result = await addComment(
            postId,
            text,
            currentCommentState.commentCount
          );
          ok = Boolean(result?.success);
          if (ok && mountedRef.current) {
            setCommentText('');
          }
        } finally {
          if (mountedRef.current) {
            setIsCommenting(false);
          }
          resolve();
        }
      }, 'Please sign in to comment');
    });

    return ok;
  }, [requireAuth, addComment, postId, commentText, currentCommentState.commentCount]);

  const handleShare = useCallback(() => {
    const url = shareUrl;

    // Prefer Web Share API if available
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      (navigator as any)
        .share({ title: 'Check out this post', url })
        .catch(() => {
          // Swallow user-cancel or policy errors
        });
      return;
    }

    // Fallback to clipboard copy
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          // Optionally trigger a toast here
          // e.g., toast({ title: 'Link copied', description: 'Share it anywhere!' });
        })
        .catch(() => {
          // Last-resort fallback
          try {
            const tmp = document.createElement('textarea');
            tmp.value = url;
            tmp.setAttribute('readonly', '');
            tmp.style.position = 'absolute';
            tmp.style.left = '-9999px';
            document.body.appendChild(tmp);
            tmp.select();
            document.execCommand('copy');
            document.body.removeChild(tmp);
          } catch {
            // no-op
          }
        });
      return;
    }
  }, [shareUrl]);

  return {
    // Derived state
    isLiked: currentLikeState.isLiked,
    likeCount: currentLikeState.likeCount,
    commentCount: currentCommentState.commentCount,
    newComment: currentCommentState.newComment,

    // Local state
    commentText,
    isCommenting,

    // Actions
    handleLike,
    handleComment,
    handleShare,
    setCommentText,
    submitComment,
  };
};
