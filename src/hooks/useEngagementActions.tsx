import { useState } from 'react';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useNavigate } from 'react-router-dom';

export interface EngagementState {
  isLiked: boolean;
  likeCount: number;
  commentCount: number;
}

export const useEngagementActions = (postId: string, eventId: string, initialState: EngagementState) => {
  const { toggleLike, addComment, getOptimisticData, getOptimisticCommentData } = useOptimisticReactions();
  const { requireAuth } = useAuthGuard();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  // Get current state (optimistic or fallback)
  const currentLikeState = getOptimisticData(postId, {
    isLiked: initialState.isLiked,
    likeCount: initialState.likeCount
  });

  const currentCommentState = getOptimisticCommentData(postId, {
    commentCount: initialState.commentCount
  });

  const handleLike = () => {
    requireAuth(() => {
      toggleLike(postId, currentLikeState.isLiked, currentLikeState.likeCount);
    }, 'Please sign in to like posts');
  };

  const handleComment = (openCommentModal?: () => void) => {
    if (openCommentModal) {
      // Use modal if available - no redirect
      requireAuth(openCommentModal, 'Please sign in to comment');
    } else {
      // Focus comment input if on same page, otherwise navigate
      const commentInput = document.querySelector('#comment-input') as HTMLInputElement;
      if (commentInput) {
        commentInput.focus();
        commentInput.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate(`/event/${eventId}#comments`);
      }
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return false;
    
    setIsCommenting(true);
    try {
      const result = await addComment(postId, commentText, currentCommentState.commentCount);
      
      if (result?.success) {
        setCommentText('');
        return true;
      }
      return false;
    } finally {
      setIsCommenting(false);
    }
  };

  const handleShare = () => {
    // Use native share or fallback
    if (navigator.share) {
      navigator.share({
        title: 'Check out this post',
        url: `${window.location.origin}/event/${eventId}`,
      }).catch(console.error);
    } else {
      // Copy to clipboard fallback
      navigator.clipboard.writeText(`${window.location.origin}/event/${eventId}`).then(() => {
        // Toast notification handled by share functionality
      }).catch(console.error);
    }
  };

  return {
    // State
    isLiked: currentLikeState.isLiked,
    likeCount: currentLikeState.likeCount,
    commentCount: currentCommentState.commentCount,
    newComment: currentCommentState.newComment,
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