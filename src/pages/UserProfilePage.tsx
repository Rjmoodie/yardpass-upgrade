import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Crown, Ticket, Clock, MapPin, Calendar, Users, Star, Share2, Heart, MessageCircle, MoreHorizontal, ArrowLeft, User, Settings, Camera, Grid3X3, List, Play } from 'lucide-react';
import { useShare } from '@/hooks/useShare';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';
import { useIsMobile } from '@/hooks/useIsMobile';
import { routes } from '@/lib/routes';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { MediaPostGrid } from '@/components/MediaPostGrid';
import { UserPostCard } from '@/components/UserPostCard';
import { FeedItem } from '@/hooks/unifiedFeedTypes';

// Types
interface UserProfile {
  user_id: string;
  display_name: string;
  phone?: string;
  role: string;
  verification_status: string;
  photo_url?: string;
  created_at: string;
  social_links?: Array<{
    platform: string;
    url: string;
  }>;
}

interface UserTicket {
  id: string;
  status: string;
  created_at: string;
  events: {
    id: string;
    title: string;
    cover_image_url?: string;
    start_at: string;
  };
}

interface UserEvent {
  id: string;
  title: string;
  cover_image_url?: string;
  start_at: string;
  end_at: string;
  location?: string;
  description?: string;
}

interface ProfilePostWithEvent {
  id: string;
  content?: string;
  media_urls?: string[];
  created_at: string;
  events: {
    id: string;
    title: string;
    cover_image_url?: string;
    start_at: string;
  };
  metrics?: {
    likes: number;
    comments: number;
  };
  viewer_has_liked?: boolean;
}

// Helper function to map profile posts to feed items
function mapProfilePostToFeedItem(post: ProfilePostWithEvent): FeedItem {
  return {
    item_type: 'post',
    item_id: post.id,
    event_id: post.events.id,
    event_title: post.events.title,
    event_cover_image: post.events.cover_image_url || DEFAULT_EVENT_COVER,
    event_start_at: post.events.start_at,
    author_id: '', // Will be filled by the component
    author_display_name: '', // Will be filled by the component
    author_photo_url: null, // Will be filled by the component
    content: post.content || '',
    media_urls: post.media_urls || [],
    created_at: post.created_at,
    metrics: post.metrics || { likes: 0, comments: 0 },
    viewer_has_liked: post.viewer_has_liked || false,
    sponsors: null,
    promotion: null,
  };
}

export default function UserProfilePage() {
  console.log('UserProfilePage component starting...');
  
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser, profile: currentProfile } = useAuth();
  
  console.log('UserProfilePage hooks initialized:', {
    username,
    currentUser: !!currentUser,
    currentProfile: !!currentProfile
  });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [profilePosts, setProfilePosts] = useState<ProfilePostWithEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user profile data
  useEffect(() => {
    if (username) {
      // Fetch specific user's profile
      fetchUserProfile(username);
    } else if (currentUser && currentProfile) {
      // When no username is provided, show current user's profile
      try {
        setProfile({
          user_id: currentUser.id,
          display_name: currentProfile.display_name || 'User',
          phone: currentProfile.phone || null,
          role: currentProfile.role || 'attendee',
          verification_status: currentProfile.verification_status || 'none',
          photo_url: currentProfile.photo_url || null,
          created_at: new Date().toISOString(),
          social_links: null,
        });
        setLoading(false);
      } catch (error) {
        console.error('Error setting current user profile:', error);
        setLoading(false);
      }
    }
  }, [username, currentUser, currentProfile]);

  // Fetch user tickets and events
  useEffect(() => {
    if (profile?.user_id) {
      fetchUserData(profile.user_id);
    }
  }, [profile?.user_id]);

  const fetchUserProfile = async (username: string) => {
    try {
      setLoading(true);
      // Implementation would go here for fetching specific user profile
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setLoading(false);
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      console.log('Fetching user data for userId:', userId);
      
      // Fetch tickets, events, and posts for the user
      const [ticketsResult, eventsResult, postsResult] = await Promise.all([
        supabase
          .from('tickets')
          .select(`
            id,
            status,
            created_at,
            events (
              id,
              title,
              cover_image_url,
              start_at
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('events')
          .select('id, title, cover_image_url, start_at, end_at, location, description')
          .eq('organizer_id', userId)
          .order('start_at', { ascending: false }),
        
        supabase
          .from('posts')
          .select(`
            id,
            content,
            media_urls,
            created_at,
            events (
              id,
              title,
              cover_image_url,
              start_at
            )
          `)
          .eq('author_id', userId)
          .order('created_at', { ascending: false })
      ]);

      console.log('Tickets result:', ticketsResult);
      console.log('Events result:', eventsResult);
      console.log('Posts result:', postsResult);

      if (ticketsResult.data) {
        console.log('Setting tickets:', ticketsResult.data);
        setTickets(ticketsResult.data as UserTicket[]);
      }
      if (eventsResult.data) {
        console.log('Setting events:', eventsResult.data);
        setEvents(eventsResult.data as UserEvent[]);
      }
      if (postsResult.data) {
        console.log('Setting posts:', postsResult.data);
        setProfilePosts(postsResult.data as ProfilePostWithEvent[]);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">User Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The user profile you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate('/')}>Return Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="relative border-b border-border/40 bg-gradient-to-r from-primary/5 via-background to-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_60%)]" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4 md:items-center">
              <Button
                onClick={() => navigate('/')}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-r from-primary/80 to-accent/70 shadow-xl flex items-center justify-center">
                    {profile.photo_url ? (
                      <img
                        src={profile.photo_url}
                        alt={profile.display_name}
                        className="h-20 w-20 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-10 w-10 text-white" />
                    )}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {profile.display_name}
                  </h1>
                  <div className="flex items-center gap-2">
                    <Badge variant={profile.role === 'organizer' ? 'default' : 'outline'}>
                      {profile.role === 'organizer' ? (
                        <>
                          <Crown className="mr-1 h-3 w-3" />
                          Organizer
                        </>
                      ) : (
                        'Attendee'
                      )}
                    </Badge>
                    {profile.verification_status === 'verified' && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        ✓ Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {!username && (
              <Button
                onClick={() => navigate('/edit-profile')}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Tabs defaultValue="posts" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="posts">Posts</TabsTrigger>
                  <TabsTrigger value="tickets">Tickets</TabsTrigger>
                </TabsList>
                
                <TabsContent value="posts" className="mt-6">
                  {profilePosts.length > 0 ? (
                    <div className="space-y-4">
                      {profilePosts.map((post) => {
                        const feedItem = mapProfilePostToFeedItem(post);
                        return (
                          <UserPostCard
                            key={post.id}
                            item={feedItem}
                            onLike={() => {}}
                            onComment={() => {}}
                            onShare={() => {}}
                            onEventClick={(eventId) => navigate(routes.event(eventId))}
                            onAuthorClick={() => {}}
                            onCreatePost={() => {}}
                            onReport={() => {}}
                            onSoundToggle={() => {}}
                            onVideoToggle={() => {}}
                            onOpenTickets={(eventId) => navigate(routes.event(eventId))}
                            soundEnabled={true}
                            isVideoPlaying={false}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                      <p className="text-muted-foreground mb-4">
                        {profile.role === 'organizer'
                          ? 'Share moments from your events to engage your community.'
                          : 'Start capturing and sharing your event experiences.'}
                      </p>
                      <Button onClick={() => navigate('/posts-test')}>
                        Create Your First Post
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tickets" className="mt-6">
                  {tickets.length > 0 ? (
                    <div className="space-y-4">
                      {tickets.map((ticket) => {
                        const evt = ticket.events;
                        const cover = evt?.cover_image_url || DEFAULT_EVENT_COVER;
                        return (
                          <Card
                            key={ticket.id}
                            className="group cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-background/70 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            onClick={() => navigate(routes.event(evt.id))}
                          >
                            <CardContent className="p-6">
                              <div className="flex items-center gap-4">
                                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
                                  <img
                                    src={cover}
                                    alt={evt.title}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                                    {evt.title}
                                  </h3>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4" />
                                      {new Date(evt.start_at).toLocaleDateString()}
                                    </div>
                                    <Badge variant={ticket.status === 'redeemed' ? 'default' : 'secondary'}>
                                      {ticket.status}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No tickets yet</h3>
                      <p className="text-muted-foreground mb-4">
                        You haven't claimed any tickets to events yet.
                      </p>
                      <Button onClick={() => navigate('/events')}>
                        Browse Events
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <aside className="space-y-6">
              <Card className="border-border/50 bg-background/70">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Activity Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Events attended</span>
                      <span className="font-medium">{tickets.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Events hosted</span>
                      <span className="font-medium">{events.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Posts created</span>
                      <span className="font-medium">{profilePosts.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Member since</span>
                      <span className="font-medium">
                        {new Date(profile.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}