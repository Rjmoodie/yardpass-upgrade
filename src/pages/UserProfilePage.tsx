import { useState, useEffect, useMemo } from 'react';
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
import { SocialLinkDisplay } from '@/components/SocialLinkDisplay';
import { EventFeed } from '@/components/EventFeed';
import { PayoutPanel } from '@/components/PayoutPanel';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';

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
    is_primary: boolean;
  }>;
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
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');

  // derived
  const initials = useMemo(
    () =>
      (profile?.display_name || '')
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    [profile?.display_name]
  );

  // Meta based on route param first (fast), then refined once profile loads
  useEffect(() => {
    if (username) {
      updateMetaTags({
        title: `${username} on YardPass`,
        description: `Check out ${username}'s profile on YardPass`,
        url: `https://yardpass.com/u/${username}`,
        type: 'article',
      });
    }
  }, [username]);

  useEffect(() => {
    if (username) fetchUserProfile(username);
  }, [username]);

  async function fetchUserProfile(identifier: string) {
    try {
      setLoading(true);

      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          identifier
        );

      // Profile lookup by id (uuid) or by display_name
      let q = supabase.from('user_profiles').select('*, social_links');
      q = isUUID ? q.eq('user_id', identifier) : q.ilike('display_name', `%${identifier}%`);
      const { data: profiles, error: profileError } = await q.limit(1);

      if (profileError) throw profileError;
      if (!profiles?.length) throw new Error('User not found');

      const userProfile = {
        ...profiles[0],
        social_links: Array.isArray(profiles[0].social_links) 
          ? profiles[0].social_links as Array<{platform: string; url: string; is_primary: boolean}>
          : []
      } as UserProfile;
      setProfile(userProfile);

      // Refine meta with real display name
      updateMetaTags({
        title: `${userProfile.display_name} on YardPass`,
        description: `Check out ${userProfile.display_name}'s profile on YardPass`,
        url: `https://yardpass.com/u/${identifier}`,
        type: 'article',
        image: userProfile.photo_url || undefined,
      });

      // Tickets
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          id,
          status,
          created_at,
          events:events!tickets_event_id_fkey (
            id,
            title,
            start_at,
            venue,
            address,
            cover_image_url,
            category
          ),
          ticket_tiers:ticket_tiers!tickets_tier_id_fkey (
            name,
            badge_label
          )
        `)
        .eq('owner_user_id', userProfile.user_id)
        .in('status', ['issued', 'transferred', 'redeemed'])
        .order('created_at', { ascending: false });

      if (ticketError) throw ticketError;
      setTickets((ticketData || []) as unknown as UserTicket[]);

      // Events organized
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id,title,start_at,venue,address,cover_image_url,category')
        .eq('created_by', userProfile.user_id)
        .eq('visibility', 'public')
        .order('start_at', { ascending: false });

      if (eventError) throw eventError;
      setEvents((eventData || []) as UserEvent[]);

      // analytics
      capture('user_profile_view', {
        profile_user_id: userProfile.user_id,
        profile_name: userProfile.display_name,
      });
    } catch (err) {
      console.error('Error loading user profile:', err);
      toast({
        title: 'User Not Found',
        description: "The user profile you're looking for doesn't exist.",
        variant: 'destructive',
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  const handleBack = () => navigate('/');

  const getVerificationBadge = () => {
    if (profile?.verification_status === 'verified') {
      return <Badge variant="secondary" className="ml-2">Verified</Badge>;
    }
    if (profile?.verification_status === 'pro') {
      return <Badge variant="default" className="ml-2">Pro</Badge>;
    }
    return null;
    };

  const getRoleBadge = () =>
    profile?.role === 'organizer' ? (
      <Badge variant="outline" className="flex items-center gap-1">
        <Crown className="w-3 h-3" />
        Organizer
      </Badge>
    ) : (
      <Badge variant="outline">Attendee</Badge>
    );

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
            className="min-h-[40px] min-w-[40px] transition-all duration-200 hover:bg-primary/10 active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-4 flex-1">
            <Avatar className="w-16 h-16">
              <AvatarImage src={profile.photo_url} alt={profile.display_name} />
              <AvatarFallback className="text-lg bg-gradient-to-br from-primary/20 to-accent/20">
                {initials || profile.display_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <h1 className="text-xl font-bold truncate">{profile.display_name}</h1>
                {getVerificationBadge()}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {getRoleBadge()}
                <span className="text-sm text-muted-foreground">
                  Member since{' '}
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                  })}
                </span>
              </div>
              
              {/* Social Links */}
              {profile.social_links && Array.isArray(profile.social_links) && profile.social_links.length > 0 && (
                <div className="mt-2">
                  <SocialLinkDisplay 
                    socialLinks={profile.social_links} 
                    showPrimaryOnly={true}
                    className="text-muted-foreground hover:text-foreground"
                  />
                </div>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                const [{ sharePayload }, { buildShareUrl, getShareTitle, getShareText }] =
                  await Promise.all([import('@/lib/share'), import('@/lib/shareLinks')]);

                await sharePayload({
                  title: getShareTitle({
                    type: 'user',
                    handle: username || profile.user_id,
                    name: profile.display_name,
                  }),
                  text: getShareText({
                    type: 'user',
                    handle: username || profile.user_id,
                    name: profile.display_name,
                  }),
                  url: buildShareUrl({
                    type: 'user',
                    handle: username || profile.user_id,
                    name: profile.display_name,
                  }),
                });

                toast({ title: 'Profile Shared', description: 'Profile shared successfully!' });
              } catch (error) {
                console.error('Error sharing profile:', error);
                toast({
                  title: 'Share Failed',
                  description: 'Could not share profile. Please try again.',
                  variant: 'destructive',
                });
              }
            }}
            className="min-h-[36px] min-w-[36px] transition-all duration-200 hover:bg-primary/10 active:scale-95"
            aria-label="Share this profile"
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
          <TabsList className="grid w-full grid-cols-4 sticky top-0 z-10 bg-background border-b">
            <TabsTrigger value="posts" className="min-h-[44px]">Posts</TabsTrigger>
            <TabsTrigger value="tickets" className="min-h-[44px]">Tickets</TabsTrigger>
            <TabsTrigger value="events" className="min-h-[44px]">Events</TabsTrigger>
            <TabsTrigger value="payouts" className="min-h-[44px]">Payouts</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* POSTS */}
            <TabsContent value="posts" className="m-0">
              <EventFeed
                userId={profile.user_id}
                onEventClick={(eventId) => navigate(routes.event(eventId))}
              />
            </TabsContent>

            {/* TICKETS */}
            <TabsContent value="tickets" className="p-4 space-y-4 m-0">
              {tickets.length > 0 ? (
                <div className="space-y-3">
                  {tickets.map((ticket) => {
                    const evt = ticket.events;
                    const cover = evt?.cover_image_url || DEFAULT_EVENT_COVER;
                    return (
                      <Card
                        key={ticket.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => navigate(routes.event(evt.id))}
                        aria-label={`Open ${evt.title}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                              <img src={cover} alt={evt.title} className="w-full h-full object-cover" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium truncate">{evt.title}</h3>

                                {/* badge click -> go to event (hint tier in query) */}
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`${routes.event(evt.id)}?tier=${encodeURIComponent(ticket.ticket_tiers.badge_label)}`);
                                  }}
                                  title="View event for this tier"
                                >
                                  {ticket.ticket_tiers.badge_label}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(evt.start_at).toLocaleDateString()}
                                </div>
                                {evt.venue && (
                                  <div className="flex items-center gap-1 truncate">
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate">{evt.venue}</span>
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
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No tickets yet</p>
                  <p className="text-sm">This user hasn't attended any events.</p>
                </div>
              )}
            </TabsContent>

            {/* EVENTS */}
            <TabsContent value="events" className="p-4 space-y-4 m-0">
              {events.length > 0 ? (
                <div className="space-y-3">
                  {events.map((event) => (
                    <Card
                      key={event.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(routes.event(event.id))}
                      aria-label={`Open ${event.title}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                            <img
                              src={event.cover_image_url || DEFAULT_EVENT_COVER}
                              alt={event.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium truncate">{event.title}</h3>
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
                                <div className="flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate">{event.venue}</span>
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

            {/* PAYOUTS */}
            <TabsContent value="payouts" className="p-4 m-0">
              <PayoutPanel contextType="individual" contextId={profile.user_id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}