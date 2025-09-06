import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OptimisticReaction {
  postId: string;
  isLiked: boolean;
  likeCount: number;
}

export const useOptimisticReactions = () => {
  const [optimisticState, setOptimisticState] = useState<Record<string, OptimisticReaction>>({});
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
      // Call the new idempotent reactions function
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

  const getOptimisticData = (postId: string, fallback: { isLiked: boolean; likeCount: number }) => {
    return optimisticState[postId] || fallback;
  };

  return {
    toggleLike,
    getOptimisticData
  };
};