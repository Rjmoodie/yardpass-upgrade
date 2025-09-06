import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { updateMetaTags } from '@/utils/meta';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, MapPin, Calendar, Users, Crown, Ticket, Share } from 'lucide-react';
import { EventFeed } from '@/components/EventFeed';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';

interface UserProfile {
  user_id: string;
  display_name: string;
  phone?: string;
  role: string;
  verification_status: string;
  photo_url?: string;
  created_at: string;
}

interface UserEvent {
  id: string;
  title: string;
  start_at: string;
  venue?: string;
  address?: string;
  cover_image_url?: string;
  category?: string;
}

interface UserTicket {
  id: string;
  status: string;
  created_at: string;
  events: UserEvent;
  ticket_tiers: {
    name: string;
    badge_label: string;
  };
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();

  // Update meta tags for user profile
  useEffect(() => {
    if (username) {
      updateMetaTags({
        title: `${username} on YardPass`,
        description: `Check out ${username}'s profile on YardPass`,
        url: `https://yardpass.com/u/${username}`,
        type: 'article'
      });
    }
  }, [username]);
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => {
    if (username) {
      fetchUserProfile();
    }
  }, [username]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      
      // Check if username looks like a UUID (user ID) or is an actual username
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username!);
      
      let query = supabase.from('user_profiles').select('*');
      
      if (isUUID) {
        // Search by user_id if it's a UUID
        query = query.eq('user_id', username);
      } else {
        // Search by display_name if it's a username (fallback for existing behavior)
        query = query.ilike('display_name', `%${username}%`);
      }
      
      const { data: profiles, error: profileError } = await query.limit(1);

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        throw profileError;
      }

      if (!profiles || profiles.length === 0) {
        throw new Error('User not found');
      }

      const userProfile = profiles[0];
      setProfile(userProfile);

      // Fetch user's tickets
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          events!fk_tickets_event_id (
            id,
            title,
            start_at,
            venue,
            address,
            cover_image_url,
            category
          ),
          ticket_tiers!fk_tickets_tier_id (
            name,
            badge_label
          )
        `)
        .eq('owner_user_id', userProfile.user_id)
        .in('status', ['issued', 'transferred', 'redeemed'])
        .order('created_at', { ascending: false });

      if (ticketError) {
        console.error('Error fetching user tickets:', ticketError);
      } else {
        setTickets(ticketData || []);
      }

      // Fetch events the user has organized
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          start_at,
          venue,
          address,
          cover_image_url,
          category
        `)
        .eq('created_by', userProfile.user_id)
        .eq('visibility', 'public')
        .order('start_at', { ascending: false });

      if (eventError) {
        console.error('Error fetching user events:', eventError);
      } else {
        setEvents(eventData || []);
      }

      // Track profile view
      capture('user_profile_view', { 
        profile_user_id: userProfile.user_id,
        profile_name: userProfile.display_name
      });

    } catch (error) {
      console.error('Error loading user profile:', error);
      toast({
        title: "User Not Found",
        description: "The user profile you're looking for doesn't exist.",
        variant: "destructive",
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const getVerificationBadge = () => {
    if (profile?.verification_status === 'verified') {
      return <Badge variant="secondary" className="ml-2">Verified</Badge>;
    } else if (profile?.verification_status === 'pro') {
      return <Badge variant="default" className="ml-2">Pro</Badge>;
    }
    return null;
  };

  const getRoleBadge = () => {
    if (profile?.role === 'organizer') {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Crown className="w-3 h-3" />
          Organizer
        </Badge>
      );
    }
    return <Badge variant="outline">Attendee</Badge>;
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">User Not Found</h1>
        <p className="text-muted-foreground mb-4">The user profile you're looking for doesn't exist.</p>
        <Button onClick={handleBack}>Return Home</Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleBack}
            variant="ghost"
            size="icon"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-4 flex-1">
            <Avatar className="w-16 h-16">
              <AvatarImage src={profile.photo_url} alt={profile.display_name} />
              <AvatarFallback className="text-lg bg-gradient-to-br from-primary/20 to-accent/20">
                {profile.display_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center">
                <h1 className="text-xl font-bold">{profile.display_name}</h1>
                {getVerificationBadge()}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {getRoleBadge()}
                <span className="text-sm text-muted-foreground">
                  Member since {new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long'
                  })}
                </span>
              </div>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              import('@/lib/share').then(({ sharePayload }) => {
                import('@/lib/shareLinks').then(({ buildShareUrl, getShareTitle, getShareText }) => {
                  sharePayload({
                    title: getShareTitle({ type: 'user', handle: username || profile.user_id, name: profile.display_name }),
                    text: getShareText({ type: 'user', handle: username || profile.user_id, name: profile.display_name }),
                    url: buildShareUrl({ type: 'user', handle: username || profile.user_id, name: profile.display_name })
                  });
                });
              });
            }}
          >
            <Share className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mt-4">
          <div className="text-center">
            <div className="text-lg font-bold">{tickets.length}</div>
            <div className="text-xs text-muted-foreground">Events Attended</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">{events.length}</div>
            <div className="text-xs text-muted-foreground">Events Organized</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 sticky top-0 z-10 bg-background border-b">
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="posts" className="m-0">
              <EventFeed 
                userId={profile.user_id}
                onEventClick={(eventId) => navigate(routes.event(eventId))}
              />
            </TabsContent>

            <TabsContent value="tickets" className="p-4 space-y-4 m-0">
              {tickets.length > 0 ? (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <Card 
                      key={ticket.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(routes.event(ticket.events.id))}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                            <Ticket className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{ticket.events.title}</h3>
                              <Badge variant="outline" className="text-xs">
                                {ticket.ticket_tiers.badge_label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(ticket.events.start_at).toLocaleDateString()}
                              </div>
                              {ticket.events.venue && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {ticket.events.venue}
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge 
                            variant={ticket.status === 'redeemed' ? 'default' : 'secondary'}
                            className="capitalize"
                          >
                            {ticket.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No tickets yet</p>
                  <p className="text-sm">This user hasn't attended any events.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="events" className="p-4 space-y-4 m-0">
              {events.length > 0 ? (
                <div className="space-y-3">
                  {events.map((event) => (
                    <Card 
                      key={event.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(routes.event(event.id))}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                            {event.cover_image_url ? (
                              <img 
                                src={event.cover_image_url} 
                                alt={event.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                                <span className="text-lg">🎪</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{event.title}</h3>
                              {event.category && (
                                <Badge variant="outline" className="text-xs">
                                  {event.category}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(event.start_at).toLocaleDateString()}
                              </div>
                              {event.venue && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {event.venue}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No events organized</p>
                  <p className="text-sm">This user hasn't organized any events yet.</p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}