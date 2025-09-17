import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { SocialLinkDisplay } from '@/components/SocialLinkDisplay';
import { useTickets } from '@/hooks/useTickets';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { 
  ArrowLeft, 
  Shield, 
  Ticket, 
  Calendar,
  MapPin,
  Users,
  Star,
  Edit,
  Share as ShareIcon,
  Plus,
  Building2,
  Search,
} from 'lucide-react';
import { routes } from '@/lib/routes';

type UserPost = {
  id: string;
  content: string;
  created_at: string;
  eventId: string | null;
  eventTitle: string | null;
  eventCover: string | null;
  tierBadge: string | null;
};

type UserBadge = {
  name: string;
  count: number;
  description: string;
};

interface User {
  id: string;
  phone: string;
  name: string;
  role: 'attendee' | 'organizer';
  isVerified: boolean;
  socialLinks?: Array<{
    platform: string;
    url: string;
    is_primary: boolean;
  }>;
}

interface UserProfileProps {
  user: User;
  onRoleToggle: () => void;
  onBack: () => void;
}

function UserProfile({ user, onRoleToggle, onBack }: UserProfileProps) {
  const [userPosts, setUserPosts] = useState<UserPost[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [socialLinks, setSocialLinks] = useState<Array<{platform: string; url: string; is_primary: boolean}>>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const { tickets, loading: ticketsLoading } = useTickets();
  const navigate = useNavigate();

  const initials = useMemo(
    () =>
      user.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    [user.name]
  );

  const totalSpent = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
  const eventsAttended = tickets.length;

  useEffect(() => {
    if (!user.id) return;
    fetchUserData();
    fetchUserSocialLinks();
  }, [user.id]);

  async function fetchUserData() {
    setLoadingPosts(true);
    try {
      // Posts (normalized -> UserPost)
      const { data: posts, error: postsError } = await supabase
        .from('event_posts')
        .select(`
          id,
          text,
          created_at,
          events:events!event_posts_event_id_fkey (
            id,
            title,
            cover_image_url
          ),
          ticket_tiers:ticket_tiers!event_posts_ticket_tier_id_fkey (
            badge_label
          )
        `)
        .eq('author_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (postsError) throw postsError;

      const normalized: UserPost[] = (posts || []).map((p: any) => ({
        id: p.id,
        content: p.text || '',
        created_at: p.created_at,
        eventId: p.events?.id ?? null,
        eventTitle: p.events?.title ?? null,
        eventCover: p.events?.cover_image_url ?? null,
        tierBadge: p.ticket_tiers?.badge_label ?? null,
      }));

      setUserPosts(normalized);

      // Simple “earned badges” rollup from tickets
      const badgeCounts = new Map<string, number>();
      tickets.forEach((t: any) => {
        const name = t.badge || 'GA';
        badgeCounts.set(name, (badgeCounts.get(name) || 0) + 1);
      });
      const badges: UserBadge[] = Array.from(badgeCounts, ([name, count]) => ({
        name,
        count,
        description: `${name} tier attendee`,
      }));
      setUserBadges(badges);
    } catch (err) {
      console.error('Profile fetch error', err);
      toast({
        title: 'Error',
        description: 'Failed to load profile data.',
        variant: 'destructive',
      });
      setUserPosts([]);
      setUserBadges([]);
    } finally {
      setLoadingPosts(false);
    }
  }

  async function fetchUserSocialLinks() {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('social_links')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      if (profile?.social_links && Array.isArray(profile.social_links)) {
        setSocialLinks(profile.social_links as Array<{platform: string; url: string; is_primary: boolean}>);
      }
    } catch (err) {
      console.error('Error fetching social links:', err);
      setSocialLinks([]);
    }
  }

  const onShare = async () => {
    try {
      const [{ sharePayload }, { buildShareUrl, getShareTitle, getShareText }] =
        await Promise.all([import('@/lib/share'), import('@/lib/shareLinks')]);
      sharePayload({
        title: getShareTitle({ type: 'user', handle: user.id, name: user.name }),
        text: getShareText({ type: 'user', handle: user.id, name: user.name }),
        url: buildShareUrl({ type: 'user', handle: user.id, name: user.name }),
      });
    } catch {
      // graceful no-op
    }
  };

  const openEvent = (eventId?: string | null) => {
    if (!eventId) return;
    navigate(routes.event(eventId));
  };

  const openEventPost = (eventId?: string | null, postId?: string) => {
    if (!eventId || !postId) return;
    navigate(`${routes.event(eventId)}?tab=posts&post=${postId}`);
  };

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-muted transition-colors" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>Profile</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onShare} aria-label="Share profile">
              <ShareIcon className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/edit-profile')}
              aria-label="Edit profile"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await supabase.auth.signOut();
                  toast({ title: 'Signed out', description: 'You have been signed out.' });
                } catch {
                  toast({
                    title: 'Error',
                    description: 'Failed to sign out. Please try again.',
                    variant: 'destructive',
                  });
                }
              }}
              className="min-h-[36px] min-w-[80px] transition-all duration-200 hover:bg-red-50 hover:border-red-200 hover:text-red-700 active:scale-95"
              aria-label="Sign out"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Profile Header */}
        <div className="p-6 text-center border-b">
          <Avatar className="w-20 h-20 mx-auto mb-4">
            <AvatarFallback className="text-xl bg-gradient-to-br from-primary/20 to-accent/20">
              {initials || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <h2 className="mb-1">{user.name}</h2>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            {user.isVerified && (
              <Badge variant="secondary" className="text-xs">
                <Shield className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {user.role === 'organizer' ? 'Organizer' : 'Attendee'}
            </Badge>
          </div>
          
          {/* Social Links */}
          {socialLinks.length > 0 && (
            <div className="mt-3 flex justify-center">
              <SocialLinkDisplay 
                socialLinks={socialLinks} 
                showPrimaryOnly={true}
                className="text-muted-foreground hover:text-foreground"
              />
            </div>
          )}

          {/* Role toggle */}
          <Card className="max-w-sm mx-auto border-2 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-left flex-1">
                  <div className="text-sm font-medium">Organizer Mode</div>
                  <div className="text-xs text-muted-foreground">
                    {user.role === 'organizer'
                      ? 'Create and manage events'
                      : 'Switch to organize events'}
                  </div>
                  <div className="text-xs text-red-500 mt-1">Current role: {user.role}</div>
                </div>
                <div className="flex-shrink-0">
                  <Button
                    onClick={() => {
                      onRoleToggle();
                      toast({
                        title: 'Role Switched',
                        description: `Switched to ${
                          user.role === 'organizer' ? 'Attendee' : 'Organizer'
                        } mode`,
                      });
                    }}
                    variant={user.role === 'organizer' ? 'default' : 'outline'}
                    size="sm"
                    className="min-w-[80px] min-h-[32px] transition-all duration-200 hover:scale-105 active:scale-95"
                    aria-label={`Switch to ${
                      user.role === 'organizer' ? 'Attendee' : 'Organizer'
                    } mode`}
                  >
                    {user.role === 'organizer' ? 'Attendee' : 'Organizer'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1 border-b">
          <div className="p-4 text-center">
            <div className="text-xl">{eventsAttended}</div>
            <div className="text-xs text-muted-foreground">Events</div>
          </div>
          <div className="p-4 text-center border-x">
            <div className="text-xl">${totalSpent.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Spent</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-xl">{userPosts.length}</div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tickets" className="flex-1">
          <TabsList className="grid w-full grid-cols-3 sticky top-0 z-10 bg-background border-b">
            <TabsTrigger value="tickets" className="min-h-[44px]">Tickets</TabsTrigger>
            <TabsTrigger value="badges" className="min-h-[44px]">Badges</TabsTrigger>
            <TabsTrigger value="posts" className="min-h-[44px]">Posts</TabsTrigger>
          </TabsList>

          {/* Tickets */}
          <TabsContent value="tickets" className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3>Your Tickets</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast({ title: 'Filter', description: 'Ticket filtering coming soon!' })
                }
                className="min-h-[32px] min-w-[60px]"
              >
                Filter
              </Button>
            </div>

            <div className="space-y-3">
              {ticketsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Loading tickets...</p>
                </div>
              ) : tickets.length > 0 ? (
                tickets.slice(0, 8).map((ticket: any) => (
                  <Card
                    key={ticket.id}
                    className="overflow-hidden cursor-pointer transition hover:shadow-md"
                    onClick={() => openEvent(ticket.eventId || ticket.event_id)}
                    aria-label={`Open ${ticket.eventTitle} details`}
                  >
                  <div className="flex">
                    <ImageWithFallback
                        src={ticket.coverImage || DEFAULT_EVENT_COVER}
                      alt={ticket.eventTitle}
                      className="w-20 h-20 object-cover"
                    />
                    <CardContent className="flex-1 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="text-sm mb-1">{ticket.eventTitle}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                            <Calendar className="w-3 h-3" />
                            {ticket.eventDate}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            {ticket.eventLocation}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-xs mb-1">
                              {ticket.badge || 'GA'}
                          </Badge>
                          <div className="text-sm">${ticket.price}</div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            {ticket.ticketType || 'General Admission'}
                          </span>
                        <Badge 
                            variant={ticket.status === 'issued' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                            {ticket.status === 'issued' ? 'confirmed' : ticket.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </div>
                </Card>
                ))
              ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tickets yet</p>
                <p className="text-sm">Discover and attend amazing events!</p>
              </div>
            )}
            </div>
          </TabsContent>

          {/* Badges */}
          <TabsContent value="badges" className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3>Your Badges</h3>
              <span className="text-sm text-muted-foreground">
                {userBadges.reduce((s, b) => s + b.count, 0)} total
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {userBadges.length > 0 ? (
                userBadges.map((badge) => (
                <Card key={badge.name}>
                  <CardContent className="p-4 text-center">
                    <div className="mb-2">
                      <Badge variant="outline" className="text-sm">
                        {badge.name}
                      </Badge>
                    </div>
                    <div className="text-2xl mb-1">{badge.count}</div>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                  </CardContent>
                </Card>
                ))
              ) : (
                <div className="col-span-2 text-center py-8 text-muted-foreground">
                  <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No badges yet</p>
                  <p className="text-sm">Attend events to earn badges!</p>
                </div>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Badge Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span>Music Lover</span>
                    <span className="text-muted-foreground">2/5 events</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: '40%' }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Attend 3 more music events to unlock this badge
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Posts */}
          <TabsContent value="posts" className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3>Your Posts</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast({ title: 'Create Post', description: 'Coming soon!' })
                }
                className="min-h-[32px] min-w-[80px]"
              >
                Create Post
              </Button>
            </div>

            <div className="space-y-3">
              {loadingPosts ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Loading posts...</p>
                </div>
              ) : userPosts.length > 0 ? (
                userPosts.map((post) => (
                  <Card
                    key={post.id}
                    className="cursor-pointer transition hover:shadow-md"
                    onClick={() => openEventPost(post.eventId, post.id)}
                    aria-label={`Open post in ${post.eventTitle ?? 'event'}`}
                  >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <ImageWithFallback
                          src={post.eventCover || DEFAULT_EVENT_COVER}
                          alt={post.eventTitle || 'Event'}
                        className="w-12 h-12 rounded object-cover"
                      />
                        <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm truncate max-w-[60%]">
                              {post.eventTitle || 'Event'}
                            </span>
                            {post.tierBadge && (
                              <Badge
                                variant="outline"
                                className="text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEvent(post.eventId);
                                }}
                              >
                                {post.tierBadge}
                          </Badge>
                            )}
                        </div>
                          <p className="text-sm mb-2 line-clamp-3">{post.content}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{new Date(post.created_at).toLocaleDateString()}</span>
                          </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                ))
              ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No posts yet</p>
                <p className="text-sm">Share your event experiences!</p>
              </div>
            )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default UserProfile;