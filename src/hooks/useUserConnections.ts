import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserConnection {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  bio: string | null;
  location: string | null;
  follower_count: number;
  following_count: number;
  current_user_follow_status: 'none' | 'pending' | 'accepted' | 'declined';
  created_at: string;
}

interface MutualConnection {
  mutual_user_id: string;
  mutual_user_name: string;
  mutual_user_photo: string | null;
}

export function useUserConnections(userId?: string) {
  const { user } = useAuth();
  const [following, setFollowing] = useState<UserConnection[]>([]);
  const [followers, setFollowers] = useState<UserConnection[]>([]);
  const [requests, setRequests] = useState<UserConnection[]>([]);
  const [mutualConnections, setMutualConnections] = useState<MutualConnection[]>([]);
  const [loading, setLoading] = useState(false);

  const targetUserId = userId || user?.id;

  const loadConnections = useCallback(async () => {
    if (!targetUserId) return;
    
    setLoading(true);
    try {
      // Load following
      const { data: followingData, error: followingError } = await supabase
        .from('follow_profiles')
        .select('*')
        .eq('follower_user_id', targetUserId)
        .eq('target_type', 'user')
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      if (followingError) throw followingError;

      // Load followers
      const { data: followersData, error: followersError } = await supabase
        .from('follow_profiles')
        .select('*')
        .eq('target_id', targetUserId)
        .eq('target_type', 'user')
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      if (followersError) throw followersError;

      // Load pending requests (only for current user)
      let requestsData: UserConnection[] = [];
      if (targetUserId === user?.id) {
        const { data, error: requestsError } = await supabase
          .from('follow_profiles')
          .select('*')
          .eq('target_id', targetUserId)
          .eq('target_type', 'user')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (requestsError) throw requestsError;
        requestsData = data || [];
      }

      // Load mutual connections (only if viewing someone else's profile)
      let mutualData: MutualConnection[] = [];
      if (targetUserId !== user?.id && user?.id) {
        const { data, error: mutualError } = await supabase
          .rpc('get_mutual_connections', {
            user1_id: user.id,
            user2_id: targetUserId
          });

        if (mutualError) throw mutualError;
        mutualData = data || [];
      }

      setFollowing(followingData || []);
      setFollowers(followersData || []);
      setRequests(requestsData);
      setMutualConnections(mutualData);
    } catch (err: any) {
      console.error('Load connections error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [targetUserId, user?.id]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const searchUsers = useCallback(async (query: string, eventId?: string) => {
    if (!query.trim() || !user) return [];
    
    try {
      let queryBuilder = supabase
        .from('user_search')
        .select('*')
        .ilike('display_name', `%${query}%`)
        .neq('user_id', user.id) // Don't show current user
        .limit(20);

      // If eventId provided, filter by event attendees
      if (eventId) {
        queryBuilder = queryBuilder.eq('event_id', eventId);
      }

      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error('User search error:', err);
      throw err;
    }
  }, [user]);

  const handleFollowRequest = useCallback(async (followId: string, status: 'accepted' | 'declined') => {
    try {
      const { error } = await supabase
        .from('users.follows')
        .update({ status })
        .eq('id', followId);
      
      if (error) throw error;
      
      // Reload connections to reflect the change
      await loadConnections();
    } catch (err: any) {
      console.error('Follow request decision error:', err);
      throw err;
    }
  }, [loadConnections]);

  return {
    following,
    followers,
    requests,
    mutualConnections,
    loading,
    loadConnections,
    searchUsers,
    handleFollowRequest,
  };
}
