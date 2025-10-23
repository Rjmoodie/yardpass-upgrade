import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FollowState } from './useFollow';

export interface FollowCounts {
  followerCount: number;
  followingCount: number;
  pendingCount: number;
}

export function useFollowCounts(targetType: 'user' | 'organizer', targetId: string) {
  const [counts, setCounts] = useState<FollowCounts>({ followerCount: 0, followingCount: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!targetId) return;

    setLoading(true);
    setError(null);
    try {
      // Count followers (people following this target)
      const { count: followerCount, error: followerError } = await supabase
        .from('users.follows')
        .select('*', { count: 'exact', head: true })
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('status', 'accepted');

      if (followerError) throw followerError;

      // Count pending follow requests (only for user targets)
      let pendingCount = 0;
      if (targetType === 'user') {
        const { count, error: pendingError } = await supabase
          .from('users.follows')
          .select('*', { count: 'exact', head: true })
          .eq('target_type', 'user')
          .eq('target_id', targetId)
          .eq('status', 'pending');
        
        if (pendingError) throw pendingError;
        pendingCount = count ?? 0;
      }

      // Count following (people this target is following - only for user targets)
      let followingCount = 0;
      if (targetType === 'user') {
        const { count, error: followingError } = await supabase
          .from('users.follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_user_id', targetId)
          .eq('status', 'accepted');
        
        if (followingError) throw followingError;
        followingCount = count ?? 0;
      }

      setCounts({ 
        followerCount: followerCount ?? 0, 
        followingCount, 
        pendingCount 
      });
    } catch (err: any) {
      console.error('Failed to load follow counts', err);
      setError(err?.message ?? 'Unable to load follow counts');
      setCounts({ followerCount: 0, followingCount: 0, pendingCount: 0 });
    } finally {
      setLoading(false);
    }
  }, [targetId, targetType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { counts, loading, error, refresh };
}

export interface FollowProfileRow {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  display_name: string;
  avatar_url: string | null;
  actor_type: 'user' | 'organization';
  actor_id: string;
}

type FollowListParams = {
  targetType: 'user' | 'organizer';
  targetId: string;
  direction: 'followers' | 'following';
  includePending?: boolean;
  enabled?: boolean;
};

export function useFollowList({ targetType, targetId, direction, includePending = false, enabled = true }: FollowListParams) {
  const [rows, setRows] = useState<FollowProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !targetId) return;
    setLoading(true);
    setError(null);

    try {
      if (direction === 'followers') {
        // Get followers (people following this target)
        const { data, error: followsError } = await supabase
          .from('users.follows')
          .select('id,status,created_at,follower_user_id')
          .eq('target_type', targetType)
          .eq('target_id', targetId)
          .in('status', includePending ? ['accepted', 'pending'] : ['accepted'])
          .order('created_at', { ascending: false });

        if (followsError) throw followsError;
        
        // All followers are users in current schema
        const userIds = (data ?? [])
          .map(row => row.follower_user_id)
          .filter((id): id is string => Boolean(id));

        const { data: userProfiles, error: profilesError } = userIds.length
          ? await supabase
              .from('users.user_profiles')
              .select('user_id,display_name,photo_url')
              .in('user_id', Array.from(new Set(userIds)))
          : { data: [] as any[], error: null };

        if (profilesError) throw profilesError;

        const userMap = new Map<string, { display_name: string; photo_url: string | null }>();
        (userProfiles ?? []).forEach(profile => {
          userMap.set(profile.user_id, {
            display_name: profile.display_name ?? 'Member',
            photo_url: profile.photo_url ?? null,
          });
        });

        const mapped = (data ?? []).map(row => {
          const profile = row.follower_user_id ? userMap.get(row.follower_user_id) : undefined;
          return {
            id: row.id,
            status: (row.status ?? 'accepted') as FollowProfileRow['status'],
            created_at: row.created_at,
            display_name: profile?.display_name ?? 'Member',
            avatar_url: profile?.photo_url ?? null,
            actor_type: 'user' as const,
            actor_id: row.follower_user_id ?? '',
          } satisfies FollowProfileRow;
        });

        setRows(mapped);
      } else {
        // following list
        const { data, error: followsError } = await supabase
          .from('users.follows')
          .select('id,status,created_at,target_type,target_id')
          .eq('follower_user_id', direction === 'following' ? targetId : '')
          .in('status', includePending ? ['accepted', 'pending'] : ['accepted'])
          .order('created_at', { ascending: false });

        if (followsError) throw followsError;

        const organizerIds = (data ?? [])
          .filter(row => row.target_type === 'organizer')
          .map(row => row.target_id);
        const userTargetIds = (data ?? [])
          .filter(row => row.target_type === 'user')
          .map(row => row.target_id);

        const [orgRows, userProfiles] = await Promise.all([
          organizerIds.length
            ? supabase
                .from('organizations.organizations')
                .select('id,name,logo_url')
                .in('id', Array.from(new Set(organizerIds)))
            : Promise.resolve({ data: [] as any[], error: null }),
          userTargetIds.length
            ? supabase
                .from('users.user_profiles')
                .select('user_id,display_name,photo_url')
                .in('user_id', Array.from(new Set(userTargetIds)))
            : Promise.resolve({ data: [] as any[], error: null }),
        ]);

        if (orgRows.error) throw orgRows.error;
        if (userProfiles.error) throw userProfiles.error;

        const orgMap = new Map<string, { display_name: string; photo_url: string | null }>();
        (orgRows.data ?? []).forEach(org => {
          orgMap.set(org.id, {
            display_name: org.name ?? 'Organization',
            photo_url: org.logo_url ?? null,
          });
        });

        const userMap = new Map<string, { display_name: string; photo_url: string | null }>();
        (userProfiles.data ?? []).forEach(profile => {
          userMap.set(profile.user_id, {
            display_name: profile.display_name ?? 'Member',
            photo_url: profile.photo_url ?? null,
          });
        });

        const mapped = (data ?? []).map(row => {
          if (row.target_type === 'organizer') {
            const org = orgMap.get(row.target_id) ?? { display_name: 'Organization', photo_url: null };
            return {
              id: row.id,
              status: (row.status ?? 'accepted') as FollowProfileRow['status'],
              created_at: row.created_at,
              display_name: org.display_name,
              avatar_url: org.photo_url,
              actor_type: 'organization' as const,
              actor_id: row.target_id,
            } satisfies FollowProfileRow;
          }
          const userProfile = userMap.get(row.target_id) ?? { display_name: 'Member', photo_url: null };
          return {
            id: row.id,
            status: (row.status ?? 'accepted') as FollowProfileRow['status'],
            created_at: row.created_at,
            display_name: userProfile.display_name,
            avatar_url: userProfile.photo_url,
            actor_type: 'user' as const,
            actor_id: row.target_id,
          } satisfies FollowProfileRow;
        });

        setRows(mapped);
      }
    } catch (err: any) {
      console.error('Failed to load follow list', err);
      setError(err?.message ?? 'Unable to load followers');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [direction, includePending, targetId, targetType, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, error, reload: load };
}

export function useMutualFollow(targetUserId: string | null | undefined) {
  const [outgoing, setOutgoing] = useState<FollowState>('none');
  const [incoming, setIncoming] = useState<FollowState>('none');

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !targetUserId) {
      setOutgoing('none');
      setIncoming('none');
      return;
    }

    const [{ data: outgoingRow }, { data: incomingRow }] = await Promise.all([
      supabase
        .from('users.follows')
        .select('status')
        .eq('follower_user_id', user.id)
        .eq('target_type', 'user')
        .eq('target_id', targetUserId)
        .maybeSingle(),
      supabase
        .from('users.follows')
        .select('status')
        .eq('follower_user_id', targetUserId)
        .eq('target_type', 'user')
        .eq('target_id', user.id)
        .maybeSingle(),
    ]);

    setOutgoing((outgoingRow?.status as FollowState) ?? 'none');
    setIncoming((incomingRow?.status as FollowState) ?? 'none');
  }, [targetUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    outgoing,
    incoming,
    isMutual: outgoing === 'accepted' && incoming === 'accepted',
    refresh,
  };
}
