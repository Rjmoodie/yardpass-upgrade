import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import type { FollowTargetType } from '@/hooks/useFollow';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Global realtime provider for follow updates.
 * 
 * Benefits vs per-component subscriptions:
 * - Single WebSocket channel (not N channels)
 * - Shared state across all components
 * - Automatic cleanup
 * - Better performance at scale
 * 
 * Usage:
 * 
 * // In App.tsx:
 * <FollowRealtimeProvider>
 *   <YourApp />
 * </FollowRealtimeProvider>
 * 
 * // In any component:
 * const { followState, subscribe } = useFollowRealtime();
 * 
 * useEffect(() => {
 *   const unsubscribe = subscribe({ 
 *     targetType: 'user', 
 *     targetId: userId,
 *     onUpdate: (isFollowing) => {
 *       console.log('Follow state changed:', isFollowing);
 *     }
 *   });
 *   return unsubscribe;
 * }, [userId]);
 */

interface FollowUpdate {
  targetType: FollowTargetType;
  targetId: string;
  isFollowing: boolean;
  status?: 'pending' | 'accepted' | 'declined';
}

interface FollowRealtimeContextValue {
  /**
   * Current follow state map: "targetType:targetId" → isFollowing
   */
  followState: Record<string, boolean>;
  
  /**
   * Subscribe to follow updates for a specific target.
   * Returns an unsubscribe function.
   */
  subscribe: (params: {
    targetType: FollowTargetType;
    targetId: string;
    onUpdate?: (isFollowing: boolean, status?: string) => void;
  }) => () => void;
  
  /**
   * Check if currently following a target (from cached state).
   */
  isFollowing: (targetType: FollowTargetType, targetId: string) => boolean;
}

const FollowRealtimeContext = createContext<FollowRealtimeContextValue | undefined>(undefined);

export function FollowRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [followState, setFollowState] = useState<Record<string, boolean>>({});
  
  // Store subscriber callbacks
  const subscribersRef = useRef<Map<string, Set<(isFollowing: boolean, status?: string) => void>>>(new Map());
  
  // Supabase channel ref
  const channelRef = useRef<RealtimeChannel | null>(null);

  const makeKey = useCallback((targetType: FollowTargetType, targetId: string) => {
    return `${targetType}:${targetId}`;
  }, []);

  const subscribe = useCallback((params: {
    targetType: FollowTargetType;
    targetId: string;
    onUpdate?: (isFollowing: boolean, status?: string) => void;
  }) => {
    const key = makeKey(params.targetType, params.targetId);
    
    if (params.onUpdate) {
      if (!subscribersRef.current.has(key)) {
        subscribersRef.current.set(key, new Set());
      }
      subscribersRef.current.get(key)!.add(params.onUpdate);
    }

    // Return unsubscribe function
    return () => {
      if (params.onUpdate) {
        subscribersRef.current.get(key)?.delete(params.onUpdate);
        if (subscribersRef.current.get(key)?.size === 0) {
          subscribersRef.current.delete(key);
        }
      }
    };
  }, [makeKey]);

  const isFollowing = useCallback((targetType: FollowTargetType, targetId: string) => {
    const key = makeKey(targetType, targetId);
    return followState[key] ?? false;
  }, [followState, makeKey]);

  const notifySubscribers = useCallback((key: string, isFollowing: boolean, status?: string) => {
    const callbacks = subscribersRef.current.get(key);
    if (callbacks) {
      callbacks.forEach(callback => callback(isFollowing, status));
    }
  }, []);

  useEffect(() => {
    if (!user) {
      // Clean up if user logs out
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setFollowState({});
      return;
    }

    if (import.meta.env.DEV) {
      console.log('[FollowRealtime] Setting up global follow subscription for user:', user.id);
    }

    // Create single channel for all follow updates
    const channel = supabase
      .channel('global-follow-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'follows',
          filter: `follower_user_id=eq.${user.id}`,
        },
        (payload) => {
          const { target_type, target_id, status } = payload.new as any;
          const key = `${target_type}:${target_id}`;
          
          if (import.meta.env.DEV && localStorage.getItem('verbose_follow_realtime') === 'true') {
            console.log('[FollowRealtime] ➕ Follow added:', { target_type, target_id, status });
          }

          setFollowState(prev => ({ ...prev, [key]: true }));
          notifySubscribers(key, true, status);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'follows',
          filter: `follower_user_id=eq.${user.id}`,
        },
        (payload) => {
          const { target_type, target_id } = payload.old as any;
          const key = `${target_type}:${target_id}`;
          
          if (import.meta.env.DEV && localStorage.getItem('verbose_follow_realtime') === 'true') {
            console.log('[FollowRealtime] ➖ Follow removed:', { target_type, target_id });
          }

          setFollowState(prev => ({ ...prev, [key]: false }));
          notifySubscribers(key, false);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'follows',
          filter: `follower_user_id=eq.${user.id}`,
        },
        (payload) => {
          const { target_type, target_id, status } = payload.new as any;
          const key = `${target_type}:${target_id}`;
          
          if (import.meta.env.DEV && localStorage.getItem('verbose_follow_realtime') === 'true') {
            console.log('[FollowRealtime] 🔄 Follow updated:', { target_type, target_id, status });
          }

          // Update state based on status (accepted = following, declined = not following)
          const isNowFollowing = status === 'accepted';
          setFollowState(prev => ({ ...prev, [key]: isNowFollowing }));
          notifySubscribers(key, isNowFollowing, status);
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log('[FollowRealtime] 🔌 Subscription status:', status);
        }
      });

    channelRef.current = channel;

    return () => {
      if (import.meta.env.DEV) {
        console.log('[FollowRealtime] 🔌 Cleaning up global follow subscription');
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user, notifySubscribers]);

  const value: FollowRealtimeContextValue = {
    followState,
    subscribe,
    isFollowing,
  };

  return (
    <FollowRealtimeContext.Provider value={value}>
      {children}
    </FollowRealtimeContext.Provider>
  );
}

/**
 * Hook to access the global follow realtime context.
 * 
 * @example
 * const { isFollowing, subscribe } = useFollowRealtime();
 * 
 * // Check if following from cached state:
 * const following = isFollowing('user', userId);
 * 
 * // Subscribe to updates:
 * useEffect(() => {
 *   return subscribe({
 *     targetType: 'user',
 *     targetId: userId,
 *     onUpdate: (isFollowing) => {
 *       console.log('Follow state changed:', isFollowing);
 *     }
 *   });
 * }, [userId]);
 */
export function useFollowRealtime() {
  const context = useContext(FollowRealtimeContext);
  if (!context) {
    throw new Error('useFollowRealtime must be used within FollowRealtimeProvider');
  }
  return context;
}

