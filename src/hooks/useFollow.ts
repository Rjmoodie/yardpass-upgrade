import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHasBlock } from './useBlock';
import { useAuth } from '@/contexts/AuthContext';

export type FollowTargetType = 'organizer' | 'event' | 'user';

type Target = { type: FollowTargetType; id: string };

export type FollowState = 'none' | 'pending' | 'accepted';

interface FollowError extends Error {
  code?: string;
  isBlocked?: boolean;
}

export function useFollow(target: Target) {
  const { user } = useAuth();
  const [state, setState] = useState<FollowState>('none');
  const [loading, setLoading] = useState(true);
  const [rowId, setRowId] = useState<string | null>(null);
  
  // Check if there's a block between users (only for user-to-user follows)
  const { hasBlock, isLoading: blockLoading } = useHasBlock(
    target.type === 'user' ? user?.id : null,
    target.type === 'user' ? target.id : null
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      
      // Guard: Don't query if target ID is invalid
      if (!target.id || target.id.length === 0) {
        setState('none');
        setRowId(null);
        setLoading(false);
        return;
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState('none');
        setRowId(null);
        return;
      }

      const { data, error } = await supabase
        .from('follows')
        .select('id,status')
        .eq('follower_user_id', user.id)
        .eq('target_type', target.type)
        .eq('target_id', target.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) {
        setState('none');
        setRowId(null);
      } else {
        setState((data.status as FollowState) ?? 'accepted');
        setRowId(data.id);
      }
    } catch (e) {
      console.error('useFollow refresh', e);
    } finally {
      setLoading(false);
    }
  }, [target.id, target.type]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await refresh();
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  const follow = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // ✅ BLOCKING CHECK: Prevent follow if blocked
    if (target.type === 'user' && hasBlock) {
      const error: FollowError = new Error('Cannot follow: blocking relationship exists');
      error.code = 'BLOCKED';
      error.isBlocked = true;
      throw error;
    }

    // Determine if this follow type requires approval
    const requiresApproval = target.type === 'user';
    
    // For user follows, status will be set by the database trigger based on privacy settings
    // For org/event follows, status defaults to 'accepted'
    const payload: Record<string, unknown> = {
      follower_user_id: user.id,
      target_type: target.type,
      target_id: target.id,
    };

    // Don't set status manually - let the trigger handle it for user follows
    // This ensures privacy settings are respected
    if (target.type !== 'user') {
      payload.status = 'accepted';
    }

    const { data, error } = await supabase
      .from('follows')
      .insert(payload)
      .select('id,status')
      .maybeSingle();

    if (error) {
      // Handle block-related errors from RLS
      if (error.message?.includes('block') || error.code === '42501') {
        const blockError: FollowError = new Error('Cannot follow: blocking relationship exists');
        blockError.code = 'BLOCKED';
        blockError.isBlocked = true;
        throw blockError;
      }
      throw error;
    }

    if (data) {
      setState((data.status as FollowState) ?? 'pending');
      setRowId(data.id);
    } else {
      setState('pending');
    }

    // Invalidate follow counts cache after successful follow
    if (typeof window !== 'undefined' && (window as any).__swrInvalidateFollowCounts) {
      (window as any).__swrInvalidateFollowCounts({ targetType: target.type, targetId: target.id });
    }
  }, [target.id, target.type, hasBlock]);

  const unfollow = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const query = supabase
      .from('follows')
      .delete()
      .eq('follower_user_id', user.id)
      .eq('target_type', target.type)
      .eq('target_id', target.id);

    const { error } = await query;
    if (error) throw error;
    setState('none');
    setRowId(null);

    // Invalidate follow counts cache after successful unfollow
    if (typeof window !== 'undefined' && (window as any).__swrInvalidateFollowCounts) {
      (window as any).__swrInvalidateFollowCounts({ targetType: target.type, targetId: target.id });
    }
  }, [target.id, target.type]);

  const toggle = useCallback(async () => {
    if (state === 'accepted' || state === 'pending') {
      await unfollow();
    } else {
      await follow();
    }
  }, [follow, unfollow, state]);

  const accept = useCallback(async () => {
    if (!rowId) return;
    const { error } = await supabase
      .from('follows')
      .update({ status: 'accepted' })
      .eq('id', rowId);
    if (error) throw error;
    setState('accepted');
  }, [rowId]);

  const decline = useCallback(async () => {
    if (!rowId) return;
    const { error} = await supabase
      .from('follows')
      .update({ status: 'declined' })
      .eq('id', rowId);
    if (error) throw error;
    setState('none');
  }, [rowId]);

  return {
    state,
    isFollowing: state === 'accepted',
    isPending: state === 'pending',
    isBlocked: hasBlock, // ✅ Expose block status
    toggle,
    follow,
    unfollow,
    accept,
    decline,
    refresh,
    loading: loading || blockLoading,
  };
}