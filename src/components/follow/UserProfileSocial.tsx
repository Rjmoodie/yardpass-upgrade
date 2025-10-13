import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, UserCheck, MessageCircle, MapPin, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FollowButton } from './FollowButton';
import { UserSearchModal } from './UserSearchModal';

interface UserProfile {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  bio: string | null;
  location: string | null;
  created_at: string;
  follower_count: number;
  following_count: number;
  current_user_follow_status: 'none' | 'pending' | 'accepted' | 'declined';
}

interface MutualConnection {
  mutual_user_id: string;
  mutual_user_name: string;
  mutual_user_photo: string | null;
}

interface UserProfileSocialProps {
  userId: string;
  showActions?: boolean;
  maxHeight?: string;
}

export function UserProfileSocial({ 
  userId, 
  showActions = true, 
  maxHeight = '300px' 
}: UserProfileSocialProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mutualConnections, setMutualConnections] = useState<MutualConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const loadUserProfile = useCallback(async () => {
    if (!userId || !user) return;
    
    setLoading(true);
    try {
      // Get user profile with follow stats
      const { data: profileData, error: profileError } = await supabase
        .from('user_search')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) throw profileError;

      // Get mutual connections if not viewing own profile
      let mutualData: MutualConnection[] = [];
      if (userId !== user.id) {
        const { data, error: mutualError } = await supabase
          .rpc('get_mutual_connections', {
            user1_id: user.id,
            user2_id: userId
          });

        if (mutualError) throw mutualError;
        mutualData = data || [];
      }

      setProfile(profileData);
      setMutualConnections(mutualData);
    } catch (err: any) {
      console.error('Load user profile error:', err);
      toast({
        title: 'Failed to load profile',
        description: 'Unable to load user profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId, user, toast]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const handleFollowUpdate = useCallback((newStatus: string) => {
    if (profile) {
      setProfile(prev => prev ? { ...prev, current_user_follow_status: newStatus as any } : null);
    }
  }, [profile]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p>Loading profile...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>User not found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isOwnProfile = userId === user?.id;

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.photo_url || undefined} />
              <AvatarFallback className="text-lg">
                {profile.display_name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold truncate">{profile.display_name}</h2>
              
              {profile.bio && (
                <p className="text-muted-foreground mt-1 line-clamp-2">
                  {profile.bio}
                </p>
              )}
              
              {profile.location && (
                <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {profile.location}
                </div>
              )}
              
              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Joined {new Date(profile.created_at).toLocaleDateString()}
              </div>
            </div>

            {showActions && !isOwnProfile && (
              <div className="flex items-center gap-2">
                {profile.current_user_follow_status === 'none' && (
                  <FollowButton
                    targetType="user"
                    targetId={userId}
                    onFollowUpdate={handleFollowUpdate}
                  />
                )}
                
                {profile.current_user_follow_status === 'pending' && (
                  <Badge variant="outline">
                    <UserPlus className="h-3 w-3 mr-1" />
                    Request Sent
                  </Badge>
                )}
                
                {profile.current_user_follow_status === 'accepted' && (
                  <div className="flex gap-2">
                    <Badge variant="default">
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

          {/* Stats */}
          <div className="flex gap-6 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold">{profile.follower_count}</div>
              <div className="text-sm text-muted-foreground">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{profile.following_count}</div>
              <div className="text-sm text-muted-foreground">Following</div>
            </div>
            {mutualConnections.length > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold">{mutualConnections.length}</div>
                <div className="text-sm text-muted-foreground">Mutual</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mutual Connections */}
      {mutualConnections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mutual Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {mutualConnections.slice(0, 10).map((mutual) => (
                <div key={mutual.mutual_user_id} className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={mutual.mutual_user_photo || undefined} />
                    <AvatarFallback className="text-xs">
                      {mutual.mutual_user_name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{mutual.mutual_user_name}</span>
                </div>
              ))}
              {mutualConnections.length > 10 && (
                <Badge variant="secondary" className="text-xs">
                  +{mutualConnections.length - 10} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Find People Button */}
      {showActions && (
        <div className="text-center">
          <Button 
            variant="outline" 
            onClick={() => setSearchOpen(true)}
            className="w-full"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Find More People to Follow
          </Button>
        </div>
      )}

      <UserSearchModal 
        open={searchOpen} 
        onOpenChange={setSearchOpen}
        onFollowUpdate={handleFollowUpdate}
      />
    </div>
  );
}
