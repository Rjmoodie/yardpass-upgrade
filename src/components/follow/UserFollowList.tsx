import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, UserPlus, UserCheck, UserX, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FollowButton } from './FollowButton';
import { UserSearchModal } from './UserSearchModal';
import { useFollowBatch } from '@/hooks/useFollowBatch';

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

interface UserFollowListProps {
  userId?: string; // If not provided, shows current user's connections
  showSearch?: boolean;
  maxHeight?: string;
}

export function UserFollowList({ 
  userId, 
  showSearch = true, 
  maxHeight = '400px' 
}: UserFollowListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'following' | 'followers' | 'requests'>('following');
  const [following, setFollowing] = useState<UserConnection[]>([]);
  const [followers, setFollowers] = useState<UserConnection[]>([]);
  const [requests, setRequests] = useState<UserConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const targetUserId = userId || user?.id;

  // Get all user IDs from all lists for batch follow query
  const allUserIds = useMemo(() => {
    const ids = new Set<string>();
    following.forEach(u => ids.add(u.user_id));
    followers.forEach(u => ids.add(u.user_id));
    requests.forEach(u => ids.add(u.user_id));
    return Array.from(ids);
  }, [following, followers, requests]);

  // Batch query follow states for all users in the lists
  const { followMap, isLoading: followBatchLoading } = useFollowBatch({
    targetType: 'user',
    targetIds: allUserIds,
    enabled: allUserIds.length > 0
  });

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
      let requestsData: any[] = [];
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

      setFollowing(followingData || []);
      setFollowers(followersData || []);
      setRequests(requestsData);
    } catch (err: any) {
      console.error('Load connections error:', err);
      toast({
        title: 'Failed to load connections',
        description: 'Unable to load user connections. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [targetUserId, user?.id, toast]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleFollowUpdate = useCallback((userId: string, newStatus: string) => {
    // Update the appropriate list based on the change
    setFollowing(prev => 
      prev.map(user => 
        user.user_id === userId 
          ? { ...user, current_user_follow_status: newStatus as any }
          : user
      )
    );
    setFollowers(prev => 
      prev.map(user => 
        user.user_id === userId 
          ? { ...user, current_user_follow_status: newStatus as any }
          : user
      )
    );
    setRequests(prev => 
      prev.map(user => 
        user.user_id === userId 
          ? { ...user, current_user_follow_status: newStatus as any }
          : user
      )
    );
  }, []);

  const handleFollowRequestDecision = useCallback(async (followId: string, status: 'accepted' | 'declined') => {
    try {
      const { error } = await supabase
        .from('follows')
        .update({ status })
        .eq('id', followId);
      
      if (error) throw error;
      
      toast({
        title: status === 'accepted' ? 'Follow request approved' : 'Follow request declined',
      });
      
      await loadConnections();
    } catch (err: any) {
      toast({
        title: 'Failed to update follow request',
        description: err?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [toast, loadConnections]);

  const renderUserCard = (user: UserConnection, showActions = true) => (
    <Card key={user.user_id} className="p-4">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.photo_url || undefined} />
              <AvatarFallback>
                {user.display_name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{user.display_name}</h3>
              {user.bio && (
                <p className="text-sm text-muted-foreground truncate">
                  {user.bio}
                </p>
              )}
              {user.location && (
                <p className="text-xs text-muted-foreground">
                  📍 {user.location}
                </p>
              )}
              
              <div className="flex gap-4 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {user.follower_count} followers
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {user.following_count} following
                </Badge>
              </div>
            </div>
          </div>

          {showActions && (
            <div className="flex items-center gap-2">
              {(() => {
                // Use batch-loaded follow state if available, otherwise use current_user_follow_status
                const followState = followMap[user.user_id] ?? user.current_user_follow_status;
                
                if (followState === 'none') {
                  return (
                    <FollowButton
                      targetType="user"
                      targetId={user.user_id}
                      size="sm"
                      followState={followState}
                      isLoading={followBatchLoading}
                      onFollowUpdate={(status) => handleFollowUpdate(user.user_id, status)}
                    />
                  );
                }
                
                // If already following or pending, show appropriate UI
                if (followState === 'pending') {
                  return (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFollowRequestDecision(user.user_id, 'accepted')}
                      >
                        <UserCheck className="h-3 w-3 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFollowRequestDecision(user.user_id, 'declined')}
                      >
                        <UserX className="h-3 w-3 mr-1" />
                        Decline
                      </Button>
                    </div>
                  );
                }
                
                if (followState === 'accepted') {
                  return (
                    <div className="flex gap-1">
                      <Badge variant="default" className="text-xs">
                        <UserCheck className="h-3 w-3 mr-1" />
                        Following
                      </Badge>
                      <Button size="sm" variant="outline">
                        <MessageCircle className="h-3 w-3 mr-1" />
                        Message
                      </Button>
                    </div>
                  );
                }
                
                return null;
              })()}
              
              {user.current_user_follow_status === 'pending' && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFollowRequestDecision(user.user_id, 'accepted')}
                  >
                    <UserCheck className="h-3 w-3 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleFollowRequestDecision(user.user_id, 'declined')}
                  >
                    <UserX className="h-3 w-3 mr-1" />
                    Decline
                  </Button>
                </div>
              )}
              
              {user.current_user_follow_status === 'accepted' && (
                <div className="flex gap-1">
                  <Badge variant="default" className="text-xs">
                    <UserCheck className="h-3 w-3 mr-1" />
                    Following
                  </Badge>
                  <Button size="sm" variant="outline">
                    <MessageCircle className="h-3 w-3 mr-1" />
                    Message
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const getCurrentData = () => {
    switch (activeTab) {
      case 'following': return following;
      case 'followers': return followers;
      case 'requests': return requests;
      default: return [];
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'following': return `Following (${following.length})`;
      case 'followers': return `Followers (${followers.length})`;
      case 'requests': return `Requests (${requests.length})`;
      default: return '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Connections</h2>
        {showSearch && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSearchOpen(true)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Find People
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="following">Following</TabsTrigger>
          <TabsTrigger value="followers">Followers</TabsTrigger>
          {targetUserId === user?.id && (
            <TabsTrigger value="requests">Requests</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="space-y-2">
          <div 
            className="space-y-2 overflow-y-auto"
            style={{ maxHeight }}
          >
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p>Loading connections...</p>
              </div>
            ) : getCurrentData().length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>
                  {activeTab === 'following' && 'Not following anyone yet'}
                  {activeTab === 'followers' && 'No followers yet'}
                  {activeTab === 'requests' && 'No pending requests'}
                </p>
                {activeTab === 'following' && showSearch && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setSearchOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Find People to Follow
                  </Button>
                )}
              </div>
            ) : (
              getCurrentData().map(user => renderUserCard(user, activeTab !== 'requests'))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <UserSearchModal 
        open={searchOpen} 
        onOpenChange={setSearchOpen}
        onFollowUpdate={handleFollowUpdate}
      />
    </div>
  );
}
