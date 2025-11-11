import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to manage user blocking relationships.
 * 
 * @example
 * const { isBlocked, block, unblock, isLoading } = useBlock(targetUserId);
 * 
 * // Block a user:
 * await block('They were being inappropriate');
 * 
 * // Unblock:
 * await unblock();
 */

interface UseBlockOptions {
  targetUserId: string | null | undefined;
  enabled?: boolean;
}

export function useBlock(targetUserId: string | null | undefined, enabled = true) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const checkBlock = useCallback(async () => {
    if (!enabled || !targetUserId) {
      setIsBlocked(false);
      setBlockId(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsBlocked(false);
        setBlockId(null);
        setIsLoading(false);
        return;
      }

      // Check if current user has blocked target
      const { data, error: queryError } = await supabase
        .from('blocks')
        .select('id')
        .eq('blocker_user_id', user.id)
        .eq('blocked_user_id', targetUserId)
        .maybeSingle();

      if (queryError) throw queryError;

      setIsBlocked(!!data);
      setBlockId(data?.id ?? null);
    } catch (err) {
      console.error('[useBlock] Error checking block:', err);
      setError(err as Error);
      setIsBlocked(false);
      setBlockId(null);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, enabled]);

  useEffect(() => {
    void checkBlock();
  }, [checkBlock]);

  const block = useCallback(async (reason?: string) => {
    if (!targetUserId) throw new Error('No target user ID');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('blocks')
      .insert({
        blocker_user_id: user.id,
        blocked_user_id: targetUserId,
        reason: reason ?? null,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      // Handle duplicate block gracefully
      if (error.code === '23505') {
        // Already blocked, just update state
        await checkBlock();
        return;
      }
      throw error;
    }

    setIsBlocked(true);
    setBlockId(data?.id ?? null);
  }, [targetUserId, checkBlock]);

  const unblock = useCallback(async () => {
    if (!targetUserId) throw new Error('No target user ID');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_user_id', user.id)
      .eq('blocked_user_id', targetUserId);

    if (error) throw error;

    setIsBlocked(false);
    setBlockId(null);
  }, [targetUserId]);

  return {
    isBlocked,
    blockId,
    isLoading,
    error,
    block,
    unblock,
    refresh: checkBlock,
  };
}

/**
 * Hook to check if there's any block between two users (either direction).
 * More efficient than useBlock when you only need to check, not manage blocks.
 * 
 * @example
 * const { hasBlock, isLoading } = useHasBlock(userA, userB);
 * if (hasBlock) {
 *   // Don't show messaging option
 * }
 */
export function useHasBlock(userA: string | null | undefined, userB: string | null | undefined) {
  const [hasBlock, setHasBlock] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userA || !userB) {
      setHasBlock(false);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        setIsLoading(true);

        // Check both directions
        const { data, error } = await supabase
          .from('blocks')
          .select('id')
          .or(`and(blocker_user_id.eq.${userA},blocked_user_id.eq.${userB}),and(blocker_user_id.eq.${userB},blocked_user_id.eq.${userA})`)
          .limit(1)
          .maybeSingle();

        if (!mounted) return;

        if (error) throw error;

        setHasBlock(!!data);
      } catch (err) {
        console.error('[useHasBlock] Error:', err);
        if (mounted) setHasBlock(false);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userA, userB]);

  return { hasBlock, isLoading };
}

/**
 * Hook to get list of users the current user has blocked.
 * 
 * @example
 * const { blockedUsers, isLoading, refresh } = useBlockedUsers();
 */
export function useBlockedUsers() {
  const [blockedUsers, setBlockedUsers] = useState<Array<{
    id: string;
    blockId: string;
    userId: string;
    displayName: string;
    photoUrl: string | null;
    blockedAt: string;
    reason: string | null;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBlockedUsers([]);
        setIsLoading(false);
        return;
      }

      // Fetch blocks with user profile data
      const { data: blocks, error: blocksError } = await supabase
        .from('blocks')
        .select('id, blocked_user_id, reason, created_at')
        .eq('blocker_user_id', user.id)
        .order('created_at', { ascending: false });

      if (blocksError) throw blocksError;

      if (!blocks || blocks.length === 0) {
        setBlockedUsers([]);
        setIsLoading(false);
        return;
      }

      // Fetch user profiles
      const userIds = blocks.map(b => b.blocked_user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, photo_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      const combined = blocks.map(block => ({
        id: block.id,
        blockId: block.id,
        userId: block.blocked_user_id,
        displayName: profileMap.get(block.blocked_user_id)?.display_name ?? 'User',
        photoUrl: profileMap.get(block.blocked_user_id)?.photo_url ?? null,
        blockedAt: block.created_at,
        reason: block.reason,
      }));

      setBlockedUsers(combined);
    } catch (err) {
      console.error('[useBlockedUsers] Error:', err);
      setError(err as Error);
      setBlockedUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    blockedUsers,
    isLoading,
    error,
    refresh: load,
  };
}


