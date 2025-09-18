import { useState } from 'react';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';
import { handlePostComment } from '@/utils/interactions';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useNavigate } from 'react-router-dom';

export interface EngagementState {
  isLiked: boolean;
  likeCount: number;
  commentCount: number;
}

export const useEngagementActions = (postId: string, eventId: string, initialState: EngagementState) => {
  const { toggleLike, getOptimisticData } = useOptimisticReactions();
  const { requireAuth } = useAuthGuard();
  const navigate = useNavigate();
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);

  // Get current state (optimistic or fallback)
  const currentState = getOptimisticData(postId, {
    isLiked: initialState.isLiked,
    likeCount: initialState.likeCount
  });

  const handleLike = () => {
    requireAuth(() => {
      toggleLike(postId, currentState.isLiked, currentState.likeCount);
    }, 'Please sign in to like posts');
  };

  const handleComment = (openCommentModal?: () => void) => {
    if (openCommentModal) {
      // Use modal if available
      requireAuth(openCommentModal, 'Please sign in to comment');
    } else {
      // Navigate to event page with comment focus
      navigate(`/event/${eventId}#comments`);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    
    setIsCommenting(true);
    try {
      const result = await handlePostComment(postId, commentText);
      if (result.success) {
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
        url: window.location.href,
      }).catch(console.error);
    } else {
      // Copy to clipboard fallback
      navigator.clipboard.writeText(window.location.href).then(() => {
        // Could show toast here
      }).catch(console.error);
    }
  };

  return {
    // State
    isLiked: currentState.isLiked,
    likeCount: currentState.likeCount,
    commentCount: initialState.commentCount,
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