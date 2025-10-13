import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FollowUpdate {
  targetType: 'event' | 'organizer' | 'user';
  targetId: string;
  isFollowing: boolean;
  followerCount?: number;
}

interface UseRealtimeFollowOptions {
  onFollowUpdate?: (update: FollowUpdate) => void;
}

export function useRealtimeFollow({ onFollowUpdate }: UseRealtimeFollowOptions = {}) {
  const { user } = useAuth();
  const [followState, setFollowState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;

    console.log('🔄 Setting up realtime follow subscriptions for user:', user.id);

    // Subscribe to follows where current user is the follower
    const followChannel = supabase
      .channel('user-follows-outgoing')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'follows',
          filter: `follower_user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('➕ Follow added:', payload.new);
          const { target_type, target_id } = payload.new;
          const key = `${target_type}:${target_id}`;
          
          setFollowState(prev => ({ ...prev, [key]: true }));
          onFollowUpdate?.({
            targetType: target_type,
            targetId: target_id,
            isFollowing: true
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'follows',
          filter: `follower_user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('➖ Follow removed:', payload.old);
          const { target_type, target_id } = payload.old;
          const key = `${target_type}:${target_id}`;
          
          setFollowState(prev => ({ ...prev, [key]: false }));
          onFollowUpdate?.({
            targetType: target_type,
            targetId: target_id,
            isFollowing: false
          });
        }
      )
      .subscribe((status) => {
        console.log('🔌 Follow subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up follow subscription');
      supabase.removeChannel(followChannel);
    };
  }, [user, onFollowUpdate]);

  const getFollowState = useCallback((targetType: string, targetId: string) => {
    const key = `${targetType}:${targetId}`;
    return followState[key];
  }, [followState]);

  const setFollowStateLocal = useCallback((targetType: string, targetId: string, isFollowing: boolean) => {
    const key = `${targetType}:${targetId}`;
    setFollowState(prev => ({ ...prev, [key]: isFollowing }));
  }, []);

  return {
    getFollowState,
    setFollowStateLocal,
    followState
  };
}