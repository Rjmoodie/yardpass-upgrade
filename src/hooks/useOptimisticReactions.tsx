import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OptimisticReaction {
  postId: string;
  isLiked: boolean;
  likeCount: number;
}

interface OptimisticComment {
  postId: string;
  commentCount: number;
  newComment?: {
    id: string;
    text: string;
    author_name: string;
    created_at: string;
  };
}

export const useOptimisticReactions = () => {
  const [optimisticState, setOptimisticState] = useState<Record<string, OptimisticReaction>>({});
  const [optimisticComments, setOptimisticComments] = useState<Record<string, OptimisticComment>>({});
  const { toast } = useToast();

  const toggleLike = async (postId: string, currentLiked: boolean, currentCount: number) => {
    // Optimistic update
    const newLiked = !currentLiked;
    const newCount = newLiked ? currentCount + 1 : currentCount - 1;
    
    setOptimisticState(prev => ({
      ...prev,
      [postId]: {
        postId,
        isLiked: newLiked,
        likeCount: Math.max(0, newCount)
      }
    }));

    try {
      // Call the idempotent reactions function
      const { data, error } = await supabase.functions.invoke('reactions-toggle', {
        body: { post_id: postId, kind: 'like' }
      });

      if (error) throw error;

      // Update with server response
      setOptimisticState(prev => ({
        ...prev,
        [postId]: {
          postId,
          isLiked: data.liked,
          likeCount: data.like_count
        }
      }));

    } catch (error) {
      // Rollback on error
      setOptimisticState(prev => ({
        ...prev,
        [postId]: {
          postId,
          isLiked: currentLiked,
          likeCount: currentCount
        }
      }));
      
      toast({
        title: "Error",
        description: "Failed to update reaction",
        variant: "destructive",
      });
    }
  };

  const addComment = async (postId: string, commentText: string, currentCount: number) => {
    if (!commentText.trim()) {
      toast({
        title: "Empty comment",
        description: "Please enter a comment",
        variant: "destructive",
      });
      return { success: false };
    }

    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to comment",
        variant: "destructive",
      });
      return { success: false };
    }

    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      text: commentText.trim(),
      author_name: userData.user.user_metadata?.display_name || 'You',
      created_at: new Date().toISOString()
    };

    // Optimistic update
    setOptimisticComments(prev => ({
      ...prev,
      [postId]: {
        postId,
        commentCount: currentCount + 1,
        newComment: tempComment
      }
    }));

    try {
      // Use the comments-add edge function for proper counter updates
      const { data, error } = await supabase.functions.invoke('comments-add', {
        body: { post_id: postId, text: commentText.trim() }
      });

      if (error) throw error;

      // Update with real comment data
      setOptimisticComments(prev => ({
        ...prev,
        [postId]: {
          postId,
          commentCount: data.comment_count || currentCount + 1,
          newComment: {
            id: data.comment.id,
            text: data.comment.text,
            author_name: data.comment.author_name || userData.user.user_metadata?.display_name || 'You',
            created_at: data.comment.created_at
          }
        }
      }));

      return { success: true, comment: data.comment };

    } catch (error) {
      // Rollback on error
      setOptimisticComments(prev => ({
        ...prev,
        [postId]: {
          postId,
          commentCount: currentCount,
          newComment: undefined
        }
      }));
      
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
      return { success: false };
    }
  };

  const getOptimisticData = (postId: string, fallback: { isLiked: boolean; likeCount: number }) => {
    return optimisticState[postId] || fallback;
  };

  const getOptimisticCommentData = (postId: string, fallback: { commentCount: number }) => {
    return optimisticComments[postId] || { postId, commentCount: fallback.commentCount };
  };

  return {
    toggleLike,
    addComment,
    getOptimisticData,
    getOptimisticCommentData
  };
};