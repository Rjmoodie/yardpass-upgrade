import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Users, UserPlus, UserCheck, UserX, MessageCircle, Eye, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FollowButton } from './FollowButton';

interface UserSearchResult {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  bio: string | null;
  location: string | null;
  follower_count: number;
  following_count: number;
  current_user_follow_status: 'none' | 'pending' | 'accepted' | 'declined';
}

interface UserSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId?: string; // Optional: filter users by event attendance
}

export function UserSearchModal({ open, onOpenChange, eventId }: UserSearchModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || !user) return;
    
    setSearching(true);
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
      setSearchResults(data || []);
    } catch (err: any) {
      console.error('User search error:', err);
      toast({
        title: 'Search failed',
        description: 'Unable to search users. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  }, [user, eventId, toast]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    await searchUsers(searchQuery);
  }, [searchQuery, searchUsers]);

  const handleFollowUpdate = useCallback((userId: string, newStatus: string) => {
    setSearchResults(prev => 
      prev.map(user => 
        user.user_id === userId 
          ? { ...user, current_user_follow_status: newStatus as any }
          : user
      )
    );
  }, []);

  const handleViewProfile = useCallback((userId: string) => {
    // Navigate to user profile page
    navigate(`/user/${userId}`);
    onOpenChange(false);
  }, [navigate, onOpenChange]);

  const handleStartMessage = useCallback(async (userId: string) => {
    try {
      // Create a conversation with the user
      const { data: conversation, error } = await supabase
        .from('direct_conversations')
        .insert({
          subject: null,
          request_status: 'open',
          created_by: user?.id
        })
        .select('id')
        .single();

      if (error) throw error;

      // Add both users as participants
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert([
          {
            conversation_id: conversation.id,
            participant_type: 'user',
            participant_user_id: user?.id
          },
          {
            conversation_id: conversation.id,
            participant_type: 'user',
            participant_user_id: userId
          }
        ]);

      if (participantError) throw participantError;

      // Navigate to messages with the conversation
      navigate('/messages', { state: { conversationId: conversation.id } });
      onOpenChange(false);
      
      toast({
        title: 'Conversation started',
        description: 'You can now message this user.'
      });
    } catch (error: any) {
      console.error('Failed to start conversation:', error);
      toast({
        title: 'Failed to start conversation',
        description: error.message || 'Please try again later.',
        variant: 'destructive'
      });
    }
  }, [user?.id, navigate, onOpenChange, toast]);

  const filteredResults = useMemo(() => {
    return searchResults.filter(user => 
      user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.bio && user.bio.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.location && user.location.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [searchResults, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {eventId ? 'Find People at This Event' : 'Find People to Follow'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, bio, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={searching || !searchQuery.trim()}
              variant="outline"
            >
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Search Results */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredResults.length === 0 && searchQuery && !searching && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No users found matching "{searchQuery}"</p>
              </div>
            )}

            {filteredResults.map((user) => (
              <Card key={user.user_id} className="p-4 hover:shadow-md transition-all duration-200 cursor-pointer group">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleViewProfile(user.user_id)}
                    >
                      <Avatar className="h-12 w-12 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                        <AvatarImage src={user.photo_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20">
                          {user.display_name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                          {user.display_name}
                        </h3>
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

                    <div className="flex items-center gap-2">
                      {/* Follow Button */}
                      {user.current_user_follow_status === 'none' && (
                        <FollowButton
                          targetType="user"
                          targetId={user.user_id}
                          size="sm"
                          onFollowUpdate={(status) => handleFollowUpdate(user.user_id, status)}
                        />
                      )}
                      
                      {user.current_user_follow_status === 'pending' && (
                        <Badge variant="outline" className="text-xs">
                          <UserPlus className="h-3 w-3 mr-1" />
                          Request Sent
                        </Badge>
                      )}
                      
                      {user.current_user_follow_status === 'accepted' && (
                        <Badge variant="default" className="text-xs">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Following
                        </Badge>
                      )}
                      
                      {user.current_user_follow_status === 'declined' && (
                        <Badge variant="destructive" className="text-xs">
                          <UserX className="h-3 w-3 mr-1" />
                          Declined
                        </Badge>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewProfile(user.user_id);
                          }}
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartMessage(user.user_id);
                          }}
                          title="Start Message"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
