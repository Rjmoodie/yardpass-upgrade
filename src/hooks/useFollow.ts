import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FollowTargetType = 'organizer' | 'event' | 'user';

type Target = { type: FollowTargetType; id: string };

export type FollowState = 'none' | 'pending' | 'accepted';

export function useFollow(target: Target) {
  const [state, setState] = useState<FollowState>('none');
  const [loading, setLoading] = useState(true);
  const [rowId, setRowId] = useState<string | null>(null);

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

    // Determine if this follow type requires approval
    const requiresApproval = target.type === 'user';
    const initialStatus = requiresApproval ? 'pending' : 'accepted';

    const payload: Record<string, unknown> = {
      follower_user_id: user.id,
      target_type: target.type,
      target_id: target.id,
    };

    // Only add status if the column exists (for user follows)
    if (requiresApproval) {
      payload.status = initialStatus;
    }

    const { data, error } = await supabase
      .from('follows')
      .insert(payload)
      .select('id,status')
      .maybeSingle();

    if (error) throw error;
    if (data) {
      setState((data.status as FollowState) ?? initialStatus);
      setRowId(data.id);
    } else {
      setState(initialStatus);
    }
  }, [target.id, target.type]);

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
    const { error } = await supabase
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
    toggle,
    follow,
    unfollow,
    accept,
    decline,
    refresh,
    loading,
  };
}