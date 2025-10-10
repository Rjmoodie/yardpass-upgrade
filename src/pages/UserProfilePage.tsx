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
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Users,
  Crown,
  Ticket,
  Share,
  Activity,
  Clock,
} from 'lucide-react';
import { SocialLinkDisplay } from '@/components/SocialLinkDisplay';
import { EventFeed } from '@/components/EventFeed';
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

  const attendedCount = tickets.length;
  const redeemedCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'redeemed').length,
    [tickets]
  );

  const upcomingEvent = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((event) => new Date(event.start_at).getTime() >= now)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];
  }, [events]);

  const mostRecentEvent = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())[0];
  }, [events]);

  const mostRecentTicket = useMemo(() => tickets[0], [tickets]);

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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="relative border-b border-border/40 bg-gradient-to-r from-primary/5 via-background to-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_60%)]" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4 md:items-center">
              <Button
                onClick={handleBack}
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full border-border/70 bg-background/70 backdrop-blur transition hover:border-primary/60 hover:bg-primary/10"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-white/40 shadow-lg">
                  <AvatarImage src={profile.photo_url} alt={profile.display_name} />
                  <AvatarFallback className="text-lg font-semibold uppercase">
                    {initials || profile.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold leading-tight md:text-3xl">
                      {profile.display_name}
                    </h1>
                    {getVerificationBadge()}
                    {getRoleBadge()}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Joined{' '}
                      {new Date(profile.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5" />
                      {attendedCount} {attendedCount === 1 ? 'event' : 'events'} attended
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {events.length} organized
                    </span>
                  </div>

                  {profile.social_links && Array.isArray(profile.social_links) && profile.social_links.length > 0 && (
                    <SocialLinkDisplay
                      socialLinks={profile.social_links}
                      showPrimaryOnly={true}
                      className="text-muted-foreground transition hover:text-foreground"
                    />
                  )}
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
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
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
              aria-label="Share this profile"
            >
              <Share className="h-4 w-4" />
              Share profile
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 bg-white/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/40 dark:bg-slate-900/60">
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Events attended</span>
                <span className="text-2xl font-semibold">{attendedCount}</span>
                <span className="text-xs text-muted-foreground">{redeemedCount} redeemed</span>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/40 dark:bg-slate-900/60">
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Events organized</span>
                <span className="text-2xl font-semibold">{events.length}</span>
                <span className="text-xs text-muted-foreground">{mostRecentEvent ? 'Latest ' + new Date(mostRecentEvent.start_at).toLocaleDateString() : 'No events yet'}</span>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/40 dark:bg-slate-900/60">
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Recent ticket</span>
                <span className="text-2xl font-semibold">
                  {mostRecentTicket?.ticket_tiers?.badge_label || '—'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {mostRecentTicket?.events?.title || 'No ticket activity'}
                </span>
              </CardContent>
            </Card>

            <Card className="border-0 bg-white/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/40 dark:bg-slate-900/60">
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Next appearance</span>
                {upcomingEvent ? (
                  <>
                    <span className="text-base font-semibold leading-tight">{upcomingEvent.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(upcomingEvent.start_at).toLocaleDateString()} · {upcomingEvent.venue || 'Venue TBA'}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">No upcoming events</span>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr),minmax(280px,1fr)]">
          <section className="space-y-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="rounded-3xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/40"
            >
              <TabsList className="grid w-full grid-cols-3 rounded-full bg-muted/60 p-1 text-sm">
                <TabsTrigger value="posts" className="rounded-full px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow">
                  Posts
                </TabsTrigger>
                <TabsTrigger value="tickets" className="rounded-full px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow">
                  Tickets
                </TabsTrigger>
                <TabsTrigger value="events" className="rounded-full px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow">
                  Events
                </TabsTrigger>
              </TabsList>

              <TabsContent value="posts" className="mt-6 rounded-2xl border border-border/40 bg-background/70 p-1 sm:p-3">
                <EventFeed
                  userId={profile.user_id}
                  onEventClick={(eventId) => navigate(routes.event(eventId))}
                />
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
                          aria-label={`Open ${evt.title}`}
                        >
                          <CardContent className="p-4 sm:p-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                              <div className="h-20 w-full overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">
                                <img src={cover} alt={evt.title} className="h-full w-full object-cover" />
                              </div>

                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-semibold leading-tight sm:text-lg">
                                    {evt.title}
                                  </h3>

                                  <Badge
                                    variant="outline"
                                    className="rounded-full text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(
                                        `${routes.event(evt.id)}?tier=${encodeURIComponent(ticket.ticket_tiers.badge_label)}`
                                      );
                                    }}
                                    title="View event for this tier"
                                  >
                                    {ticket.ticket_tiers.badge_label}
                                  </Badge>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {new Date(evt.start_at).toLocaleDateString()}
                                  </span>
                                  {evt.venue && (
                                    <span className="inline-flex items-center gap-1 truncate">
                                      <MapPin className="h-3.5 w-3.5" />
                                      <span className="truncate">{evt.venue}</span>
                                    </span>
                                  )}
                                </div>
                              </div>

                              <Badge
                                variant={ticket.status === 'redeemed' ? 'default' : 'secondary'}
                                className="self-start rounded-full capitalize"
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
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/40 py-12 text-center text-muted-foreground">
                    <Ticket className="mb-3 h-10 w-10 opacity-60" />
                    <p className="font-medium">No tickets yet</p>
                    <p className="text-sm">This user hasn't attended any events.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="events" className="mt-6">
                {events.length > 0 ? (
                  <div className="space-y-4">
                    {events.map((event) => (
                      <Card
                        key={event.id}
                        className="group cursor-pointer overflow-hidden rounded-2xl border border-border/50 bg-background/70 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        onClick={() => navigate(routes.event(event.id))}
                        aria-label={`Open ${event.title}`}
                      >
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                            <div className="h-20 w-full overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">
                              <img
                                src={event.cover_image_url || DEFAULT_EVENT_COVER}
                                alt={event.title}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold leading-tight sm:text-lg">{event.title}</h3>
                                {event.category && (
                                  <Badge variant="outline" className="rounded-full text-xs">
                                    {event.category}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(event.start_at).toLocaleDateString()}
                                </span>
                                {event.venue && (
                                  <span className="inline-flex items-center gap-1 truncate">
                                    <MapPin className="h-3.5 w-3.5" />
                                    <span className="truncate">{event.venue}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/40 py-12 text-center text-muted-foreground">
                    <Users className="mb-3 h-10 w-10 opacity-60" />
                    <p className="font-medium">No events organized</p>
                    <p className="text-sm">This user hasn't organized any events yet.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </section>

          <aside className="space-y-4 lg:space-y-6">
            <Card className="overflow-hidden rounded-3xl border border-border/60 bg-background/60 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/40">
              <CardContent className="space-y-4 p-6">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    About {profile.display_name.split(' ')[0] || 'this user'}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {profile.role === 'organizer'
                      ? 'Sharing the moments, milestones, and highlights from events they host.'
                      : 'Capturing experiences from events across YardPass.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Crown className="h-4 w-4" />
                      Role
                    </span>
                    <span className="font-medium capitalize">{profile.role}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Ticket className="h-4 w-4" />
                      Tickets claimed
                    </span>
                    <span className="font-medium">{tickets.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Last activity
                    </span>
                    <span className="font-medium">
                      {mostRecentTicket?.created_at
                        ? new Date(mostRecentTicket.created_at).toLocaleDateString()
                        : mostRecentEvent?.start_at
                        ? new Date(mostRecentEvent.start_at).toLocaleDateString()
                        : '—'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {upcomingEvent && (
              <Card className="overflow-hidden rounded-3xl border border-primary/30 bg-primary/10 shadow-sm">
                <CardContent className="space-y-4 p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                      Upcoming spotlight
                    </p>
                    <h3 className="mt-2 text-xl font-semibold leading-tight">{upcomingEvent.title}</h3>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(upcomingEvent.start_at).toLocaleString()}
                    </span>
                    {upcomingEvent.address && (
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{upcomingEvent.address}</span>
                      </span>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full rounded-full"
                    onClick={() => navigate(routes.event(upcomingEvent.id))}
                  >
                    View event
                  </Button>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
