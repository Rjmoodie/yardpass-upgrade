import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Target = { type: 'organizer' | 'event'; id: string };

export function useFollow(target: Target) {
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setIsFollowing(false); return; }

        const { data, error } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_user_id', user.id)
          .eq('target_type', target.type)
          .eq('target_id', target.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        if (!mounted) return;
        setIsFollowing(!!data);
      } catch (e) {
        console.error('useFollow init', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [target.type, target.id]);

  const toggle = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (isFollowing) {
      // Unfollow
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_user_id', user.id)
        .eq('target_type', target.type)
        .eq('target_id', target.id);
      if (error) throw error;
      setIsFollowing(false);
    } else {
      // Follow
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_user_id: user.id,
          target_type: target.type,
          target_id: target.id
        });
      if (error) throw error;
      setIsFollowing(true);
    }
  };

  return { isFollowing, toggle, loading };
}