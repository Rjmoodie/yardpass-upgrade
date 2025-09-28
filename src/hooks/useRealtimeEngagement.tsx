import { useEffect, useState, useCallback } from 'react';
import { useRealtime } from './useRealtime';
import type { RealtimeEvent } from './useRealtime';

interface EngagementUpdate {
  postId: string;
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
}

interface UseRealtimeEngagementOptions {
  eventIds: string[];
  userId?: string;
  onEngagementUpdate?: (update: EngagementUpdate) => void;
}

export function useRealtimeEngagement({
  eventIds,
  userId,
  onEngagementUpdate
}: UseRealtimeEngagementOptions) {
  const [engagementState, setEngagementState] = useState<Record<string, EngagementUpdate>>({});

  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    console.log('🔄 Realtime engagement event:', event.type, event.data);

    switch (event.type) {
      case 'reaction_added':
        if (event.data.kind === 'like') {
          const postId = event.data.post_id;
          setEngagementState(prev => {
            const current = prev[postId];
            const update = {
              postId,
              likeCount: current?.likeCount || 0, // Don't increment here - let the direct API response handle it
              commentCount: current?.commentCount || 0,
              viewerHasLiked: event.data.user_id === userId ? true : (current?.viewerHasLiked || false)
            };
            
            onEngagementUpdate?.(update);
            return { ...prev, [postId]: update };
          });
        }
        break;

      case 'reaction_removed':
        if (event.data.kind === 'like') {
          const postId = event.data.post_id;
          setEngagementState(prev => {
            const current = prev[postId];
            const update = {
              postId,
              likeCount: current?.likeCount || 0, // Don't decrement here - let the direct API response handle it
              commentCount: current?.commentCount || 0,
              viewerHasLiked: event.data.user_id === userId ? false : (current?.viewerHasLiked || false)
            };
            
            onEngagementUpdate?.(update);
            return { ...prev, [postId]: update };
          });
        }
        break;

      case 'comment_added':
        {
          const postId = event.data.post_id;
          setEngagementState(prev => {
            const current = prev[postId];
            const update = {
              postId,
              likeCount: current?.likeCount || 0,
              commentCount: (current?.commentCount || 0) + 1,
              viewerHasLiked: current?.viewerHasLiked || false
            };
            
            onEngagementUpdate?.(update);
            return { ...prev, [postId]: update };
          });
        }
        break;

      case 'comment_removed':
        {
          const postId = event.data.post_id;
          setEngagementState(prev => {
            const current = prev[postId];
            const update = {
              postId,
              likeCount: current?.likeCount || 0,
              commentCount: Math.max((current?.commentCount || 0) - 1, 0),
              viewerHasLiked: current?.viewerHasLiked || false
            };
            
            onEngagementUpdate?.(update);
            return { ...prev, [postId]: update };
          });
        }
        break;

      case 'post_updated':
        {
          const postId = event.data.id;
          setEngagementState(prev => {
            const update = {
              postId,
              likeCount: event.data.like_count || 0,
              commentCount: event.data.comment_count || 0,
              viewerHasLiked: prev[postId]?.viewerHasLiked || false
            };
            
            onEngagementUpdate?.(update);
            return { ...prev, [postId]: update };
          });
        }
        break;
    }
  }, [userId, onEngagementUpdate]);

  useRealtime({
    eventIds,
    userId,
    onEvent: handleRealtimeEvent,
    enableNotifications: false
  });

  const getEngagementData = useCallback((postId: string) => {
    return engagementState[postId];
  }, [engagementState]);

  const updateEngagementData = useCallback((postId: string, data: Partial<EngagementUpdate>) => {
    setEngagementState(prev => ({
      ...prev,
      [postId]: { ...prev[postId], postId, ...data }
    }));
  }, []);

  return {
    getEngagementData,
    updateEngagementData,
    engagementState
  };
}