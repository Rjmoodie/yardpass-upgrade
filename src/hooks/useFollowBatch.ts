import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FollowTargetType, FollowState } from './useFollow';

/**
 * Batch hook to check follow status for multiple targets at once.
 * Solves N+1 query problem when rendering lists of users/events/organizers.
 * 
 * @example
 * const { followMap, isLoading, refresh } = useFollowBatch({
 *   targetType: 'user',
 *   targetIds: users.map(u => u.id)
 * });
 * 
 * // Later: followMap[userId] → 'none' | 'pending' | 'accepted'
 */

interface UseFollowBatchOptions {
  targetType: FollowTargetType;
  targetIds: string[];
  enabled?: boolean; // Allow conditional fetching
}

interface FollowBatchResult {
  followMap: Record<string, FollowState>; // targetId → followState
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useFollowBatch({ 
  targetType, 
  targetIds, 
  enabled = true 
}: UseFollowBatchOptions): FollowBatchResult {
  const [followMap, setFollowMap] = useState<Record<string, FollowState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBatch = useCallback(async () => {
    // Guard: skip if disabled or no IDs
    if (!enabled || targetIds.length === 0) {
      setFollowMap({});
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      
      // If not authenticated, all states are 'none'
      if (!user) {
        const emptyMap: Record<string, FollowState> = {};
        targetIds.forEach(id => {
          emptyMap[id] = 'none';
        });
        setFollowMap(emptyMap);
        setIsLoading(false);
        return;
      }

      // Batch query: fetch all follow states in one go
      const { data, error: queryError } = await supabase
        .from('follows')
        .select('target_id, status')
        .eq('follower_user_id', user.id)
        .eq('target_type', targetType)
        .in('target_id', targetIds);

      if (queryError) throw queryError;

      // Build map: targetId → status
      const resultMap: Record<string, FollowState> = {};
      
      // Initialize all as 'none'
      targetIds.forEach(id => {
        resultMap[id] = 'none';
      });

      // Override with actual follow states
      (data || []).forEach(row => {
        resultMap[row.target_id] = (row.status as FollowState) ?? 'accepted';
      });

      setFollowMap(resultMap);

      // Debug logging (opt-in)
      if (import.meta.env.DEV && localStorage.getItem('verbose_follow_batch') === 'true') {
        console.log('[useFollowBatch] Fetched', data?.length || 0, 'follows for', targetIds.length, 'targets');
      }
    } catch (err) {
      console.error('[useFollowBatch] Error:', err);
      setError(err as Error);
      
      // Set all to 'none' on error (graceful degradation)
      const fallbackMap: Record<string, FollowState> = {};
      targetIds.forEach(id => {
        fallbackMap[id] = 'none';
      });
      setFollowMap(fallbackMap);
    } finally {
      setIsLoading(false);
    }
  }, [targetType, targetIds, enabled]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      await fetchBatch();
    })();

    return () => {
      mounted = false;
    };
  }, [fetchBatch]);

  return {
    followMap,
    isLoading,
    error,
    refresh: fetchBatch,
  };
}

/**
 * Optimized variant: only fetch for targets that aren't already in cache.
 * Useful when you have a mix of cached and uncached targets.
 * 
 * @param existingMap - Previously fetched follow states
 * @param newTargetIds - New IDs to check
 */
export function useFollowBatchIncremental({
  targetType,
  existingMap,
  newTargetIds,
}: {
  targetType: FollowTargetType;
  existingMap: Record<string, FollowState>;
  newTargetIds: string[];
}) {
  // Filter out IDs we already have
  const uncachedIds = newTargetIds.filter(id => !(id in existingMap));

  const { followMap: newMap, isLoading, error, refresh } = useFollowBatch({
    targetType,
    targetIds: uncachedIds,
    enabled: uncachedIds.length > 0,
  });

  // Merge existing + new
  const mergedMap = { ...existingMap, ...newMap };

  return {
    followMap: mergedMap,
    isLoading,
    error,
    refresh,
  };
}

