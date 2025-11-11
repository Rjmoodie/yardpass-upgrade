import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Users, UserPlus, UserCheck, UserX, MessageCircle, Eye, MoreHorizontal, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FollowButton } from './FollowButton';
import { handleUserFriendlyError } from '@/utils/errorMessages';

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
  onSelectUser?: (userId: string) => void; // Optional: callback when user is selected (for messaging)
}

export function UserSearchModal({ open, onOpenChange, eventId, onSelectUser }: UserSearchModalProps) {
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
      
      const { message } = handleUserFriendlyError(err, { 
        feature: 'search', 
        action: 'search users' 
      });
      
      toast({
        title: 'Search failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  }, [user, eventId, toast]);

  // Predictive search with debouncing
  useEffect(() => {
    // Clear results if query is too short
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    // Debounce: wait 300ms after user stops typing
    const timeoutId = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    // Cleanup timeout on query change
    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchUsers]);

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
    // If onSelectUser callback is provided, use it (for messaging integration)
    if (onSelectUser) {
      onSelectUser(userId);
      onOpenChange(false);
      return;
    }

    // Otherwise, create a conversation (original behavior)
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
      
      const { message } = handleUserFriendlyError(error, { 
        feature: 'messaging', 
        action: 'start conversation' 
      });
      
      toast({
        title: 'Failed to start conversation',
        description: message,
        variant: 'destructive'
      });
    }
  }, [user?.id, navigate, onOpenChange, toast, onSelectUser]);

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
          <DialogDescription className="sr-only">
            Search for users by name to follow or message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search Input with Live Search */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, bio, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-11"
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
              )}
            </div>
            {searchQuery.length >= 2 && !searching && filteredResults.length > 0 && (
              <p className="text-xs text-muted-foreground px-1">
                {filteredResults.length} {filteredResults.length === 1 ? 'person' : 'people'} found
              </p>
            )}
          </div>

          {/* Search Results */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {/* Loading State */}
            {searching && (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="font-medium">Searching for users...</p>
              </div>
            )}

            {/* Empty State - No Query */}
            {!searchQuery && !searching && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-2">Start searching</p>
                <p className="text-sm">Type a name, bio keyword, or location to find people</p>
              </div>
            )}

            {/* Empty State - No Results */}
            {filteredResults.length === 0 && searchQuery.length >= 2 && !searching && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-2">No users found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            )}

            {/* User Results */}
            {!searching && filteredResults.map((user) => (
              <div 
                key={user.user_id} 
                className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-all duration-200 cursor-pointer group"
                onClick={() => handleViewProfile(user.user_id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-11 w-11 ring-2 ring-transparent group-hover:ring-primary/30 transition-all shrink-0">
                    <AvatarImage src={user.photo_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-sm font-semibold">
                      {user.display_name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                        {user.display_name}
                      </h3>
                      {user.location && (
                        <span className="text-xs text-muted-foreground truncate">
                          📍 {user.location}
                        </span>
                      )}
                    </div>
                    {user.bio ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {user.bio}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {user.follower_count} followers • {user.following_count} following
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                        <span className="text-xs text-muted-foreground font-medium px-3 py-1.5 bg-muted/50 rounded-full">
                          Requested
                        </span>
                      )}
                      
                      {user.current_user_follow_status === 'accepted' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs px-3 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Could add unfollow logic here
                          }}
                        >
                          <UserCheck className="h-3 w-3 mr-1" />
                          Following
                        </Button>
                      )}
                      
                      {user.current_user_follow_status === 'declined' && (
                        <span className="text-xs text-muted-foreground font-medium">
                          Declined
                        </span>
                      )}
                    </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
