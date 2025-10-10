import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Crown,
  ArrowLeft,
  Settings,
  Users,
  Ticket,
  Calendar,
  LayoutDashboard,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { UserPostCard } from '@/components/UserPostCard';
import CommentModal from '@/components/CommentModal';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileView } from '@/contexts/ProfileViewContext';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { routes } from '@/lib/routes';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';
import { useShare } from '@/hooks/useShare';
import { useToast } from '@/hooks/use-toast';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';

interface SocialLink {
  platform: string;
  url: string;
}

interface UserProfile {
  user_id: string;
  display_name: string;
  phone: string | null;
  role: string | null;
  verification_status: string | null;
  photo_url: string | null;
  created_at: string | null;
  social_links: SocialLink[];
}

interface UserTicket {
  id: string;
  status: string | null;
  created_at: string | null;
  events: {
    id: string;
    title: string;
    cover_image_url: string | null;
    start_at: string | null;
  } | null;
}

interface UserEvent {
  id: string;
  title: string;
  cover_image_url: string | null;
  start_at: string | null;
  end_at: string | null;
}


interface ProfilePostWithEvent {
  id: string;
  text: string | null;
  media_urls: string[] | null;
  created_at: string | null;
  like_count: number | null;
  comment_count: number | null;
  events: {
    id: string;
    title: string;
    cover_image_url: string | null;
    start_at: string | null;
  } | null;
}

const normalizeSocialLinks = (value: unknown): SocialLink[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((link): link is SocialLink =>
        Boolean(link && typeof link.platform === 'string' && typeof link.url === 'string')
      )
      .map((link) => ({ platform: link.platform, url: link.url }));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, string>)
      .filter(([, url]) => typeof url === 'string' && url.length > 0)
      .map(([platform, url]) => ({ platform, url }));
  }

  return [];
};

const toFeedItem = (post: ProfilePostWithEvent, profile: UserProfile | null): FeedItem & { item_type: 'post' } => {
  const event = post.events;

  return {
    item_type: 'post',
    sort_ts: post.created_at ?? new Date().toISOString(),
    item_id: post.id,
    event_id: event?.id ?? '',
    event_title: event?.title ?? 'Event',
    event_description: '',
    event_starts_at: event?.start_at ?? null,
    event_cover_image: event?.cover_image_url ?? DEFAULT_EVENT_COVER,
    event_organizer: '',
    event_organizer_id: null,
    event_owner_context_type: 'event',
    event_location: '',
    author_id: profile?.user_id ?? null,
    author_name: profile?.display_name ?? null,
    author_badge: profile?.role === 'organizer' ? 'ORGANIZER' : null,
    author_social_links: profile?.social_links ?? null,
    media_urls: post.media_urls ?? [],
    content: post.text ?? '',
    metrics: {
      likes: post.like_count ?? 0,
      comments: post.comment_count ?? 0,
      viewer_has_liked: false,
    },
    sponsor: null,
    sponsors: null,
    promotion: null,
  };
};

const LoadingState = () => (
  <div className="h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const EmptyState = ({
  isSelf,
}: {
  isSelf: boolean;
}) => (
  <div className="text-center py-12">
    <p className="text-lg font-semibold mb-2">No posts to show yet</p>
    <p className="text-muted-foreground">
      {isSelf
        ? 'Share updates from the events you attend to start building your story.'
        : 'This user has not shared any posts yet.'}
    </p>
  </div>
);

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'TBD';
  try {
    return new Date(value).toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'TBD';
  }
};

export default function UserProfilePage() {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();
  const { user: currentUser, profile: currentProfile } = useAuth();
  const { activeView, setActiveView } = useProfileView();
  const { requireAuth } = useAuthGuard();
  const { toggleLike, getOptimisticData } = useOptimisticReactions();
  const { sharePost } = useShare();
  const { toast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [posts, setPosts] = useState<ProfilePostWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialViewSet, setInitialViewSet] = useState(false);
  const [commentContext, setCommentContext] = useState<{ postId: string; eventId: string; eventTitle: string } | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);

  const isViewingOwnProfile = useMemo(() => {
    if (!profile || !currentUser) return false;
    return profile.user_id === currentUser.id;
  }, [profile, currentUser]);

  // Set initial view only once when profile loads, respecting user's localStorage choice
  useEffect(() => {
    if (profile && !initialViewSet && isViewingOwnProfile) {
      // Check if user has a stored preference
      const storedView = localStorage.getItem('yardpass-profile-view-mode');
      
      // If no stored preference exists, set a sensible default based on user role
      if (!storedView) {
        if (profile.role === 'organizer') {
          setActiveView('organizer');
        }
      }
      // If stored preference exists, it will be used by the context automatically
      
      setInitialViewSet(true);
    }
  }, [profile, initialViewSet, isViewingOwnProfile, setActiveView]);

  useEffect(() => {
    const loadUserData = async (userId: string) => {
      const [ticketsResult, eventsResult, postsResult]: [any, any, any] = await Promise.all([
        supabase
          .from('tickets')
          .select(
            `
              id,
              status,
              created_at,
              events!tickets_event_id_fkey (
                id,
                title,
                cover_image_url,
                start_at
              )
            `
          )
          .eq('owner_user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('*')
          .eq('created_by', userId)
          .order('start_at', { ascending: false })
,
        supabase
          .from('event_posts')
          .select(
            `
              id,
              text,
              media_urls,
              created_at,
              like_count,
              comment_count,
              events:events!event_posts_event_id_fkey (
                id,
                title,
                cover_image_url,
                start_at
              )
            `
          )
          .eq('author_user_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      if (ticketsResult.error) {
        console.error('Error loading tickets:', ticketsResult.error);
      }
      if (eventsResult.error) {
        console.error('Error loading events:', eventsResult.error);
      } else {
        console.log('Events loaded successfully:', eventsResult.data);
      }
      if (postsResult.error) {
        console.error('Error loading posts:', postsResult.error);
      }

      setTickets((ticketsResult.data as UserTicket[] | null) ?? []);
      setEvents((eventsResult.data as any) ?? []);
      setPosts((postsResult.data as ProfilePostWithEvent[] | null) ?? []);
    };

    const loadProfile = async () => {
      setLoading(true);

      try {
        if (username) {
          const result = await supabase
            .from('user_profiles')
            .select('user_id, display_name, phone, role, verification_status, photo_url, created_at, social_links')
            .eq('user_id', username)
            .maybeSingle();

          if (result.error) {
            throw result.error;
          }

          if (!result.data) {
            setProfile(null);
            setTickets([]);
            setPosts([]);
            return;
          }

          const userProfile: UserProfile = {
            user_id: result.data.user_id,
            display_name: result.data.display_name,
            phone: result.data.phone,
            role: result.data.role,
            verification_status: result.data.verification_status,
            photo_url: result.data.photo_url,
            created_at: result.data.created_at,
            social_links: normalizeSocialLinks(result.data.social_links),
          };

          setProfile(userProfile);
          await loadUserData(userProfile.user_id);
          return;
        }

        if (currentUser && currentProfile) {
          const userProfile: UserProfile = {
            user_id: currentUser.id,
            display_name: currentProfile.display_name || 'User',
            phone: currentProfile.phone || null,
            role: currentProfile.role || 'attendee',
            verification_status: currentProfile.verification_status || null,
            photo_url: currentProfile.photo_url || null,
            created_at: (currentProfile as any)?.created_at || new Date().toISOString(),
            social_links: normalizeSocialLinks((currentProfile as any)?.social_links),
          };

          setProfile(userProfile);
          await loadUserData(userProfile.user_id);
          return;
        }

        setProfile(null);
        setTickets([]);
        setEvents([]);
        setPosts([]);
      } catch (error) {
        console.error('Error loading user profile:', error);
        setProfile(null);
        setTickets([]);
        setEvents([]);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, currentUser, currentProfile]);

  const feedItems = useMemo(() => posts.map((post) => toFeedItem(post, profile)), [posts, profile]);

  const statsByRole = useMemo(
    () => ({
      attendee: [
        { label: 'Posts', value: posts.length },
        { label: 'Events attended', value: tickets.length },
        {
          label: 'Total reactions',
          value: posts.reduce((sum, post) => sum + (post.like_count ?? 0) + (post.comment_count ?? 0), 0),
        },
      ],
      organizer: [
        { label: 'Posts', value: posts.length },
        { label: 'Events hosted', value: events.length },
        {
          label: 'Total reactions',
          value: posts.reduce((sum, post) => sum + (post.like_count ?? 0) + (post.comment_count ?? 0), 0),
        },
      ],
    }),
    [posts.length, tickets.length, events.length]
  );

  const displayedStats = statsByRole[activeView];

  const primaryRoleAction = useMemo(
    () =>
      activeView === 'organizer'
        ? {
            label: 'Go to dashboard',
            icon: LayoutDashboard,
            onClick: () => navigate('/dashboard'),
          }
        : {
            label: 'View tickets',
            icon: Ticket,
            onClick: () => navigate('/tickets'),
          },
    [activeView, navigate]
  );

  const PrimaryRoleIcon = primaryRoleAction.icon;

  // Engagement handlers
  const handleLike = (postId: string) => {
    const item = feedItems.find((item) => item.item_id === postId);
    if (!item || item.item_type !== 'post') return;

    const snapshot = getOptimisticData(item.item_id, {
      isLiked: item.metrics.viewer_has_liked ?? false,
      likeCount: item.metrics.likes ?? 0,
    });

    requireAuth(() => {
      void (async () => {
        const result = await toggleLike(
          item.item_id,
          snapshot.isLiked,
          snapshot.likeCount
        );
        if (result.ok) {
          // Update local state to reflect change
          setPosts((prevPosts) =>
            prevPosts.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    like_count: result.likeCount,
                    viewer_has_liked: result.isLiked,
                  }
                : post
            )
          );
        }
      })();
    }, 'Please sign in to like posts');
  };

  const handleComment = (postId: string) => {
    const item = feedItems.find((item) => item.item_id === postId);
    if (!item || item.item_type !== 'post') return;

    requireAuth(() => {
      setCommentContext({
        postId: item.item_id,
        eventId: item.event_id,
        eventTitle: item.event_title,
      });
      setShowCommentModal(true);
    }, 'Please sign in to comment');
  };

  const handleSharePost = (postId: string) => {
    const item = feedItems.find((item) => item.item_id === postId);
    if (!item || item.item_type !== 'post') return;

    sharePost(item.item_id, item.event_title, item.content ?? undefined);
  };

  const handleReport = () => {
    toast({
      title: 'Report received',
      description: 'Thanks for flagging this. Our safety team will take a look.',
    });
  };

  // Debug logging
  console.log('Current state:', {
    activeView,
    eventsCount: events.length,
    ticketsCount: tickets.length,
    postsCount: posts.length,
    displayedStats
  });

  if (loading) {
    return <LoadingState />;
  }

  if (!profile) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">User not found</h1>
        <p className="text-muted-foreground mb-4">We couldn't find the profile you were looking for.</p>
        <Button onClick={() => navigate('/')}>Return home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      <div className="border-b border-border/40 bg-gradient-to-r from-primary/5 via-background to-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4 md:items-center">
              <Button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate('/');
                  }
                }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-gradient-to-r from-primary/80 to-accent/70 shadow-xl flex items-center justify-center overflow-hidden">
                  {profile.photo_url ? (
                    <img src={profile.photo_url} alt={profile.display_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-semibold text-white">{profile.display_name.charAt(0)}</span>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      {profile.display_name}
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>Member since {formatDate(profile.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={profile.role === 'organizer' ? 'default' : 'outline'}>
                      {profile.role === 'organizer' ? (
                        <>
                          <Crown className="mr-1 h-3 w-3" /> Organizer
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

            {isViewingOwnProfile && (
              <Button onClick={() => navigate('/edit-profile')} variant="outline" size="sm" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Edit profile
              </Button>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Activity overview {activeView === 'organizer' ? '(Organizer View)' : '(Attendee View)'}
              </h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <ToggleGroup
                  type="single"
                  value={activeView}
                  onValueChange={(value) => {
                    console.log('Toggle changed to:', value);
                    if (value === 'attendee' || value === 'organizer') {
                      setActiveView(value);
                      console.log('Active view set to:', value);
                    }
                  }}
                  variant="outline"
                  className="w-fit rounded-full bg-background/80 p-1 shadow-sm transition-colors"
                  aria-label="Toggle between attendee and organizer stats"
                >
                  <ToggleGroupItem
                    value="attendee"
                    className="rounded-full px-4 py-2 text-sm transition-all duration-200 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md"
                  >
                    Attendee view
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="organizer"
                    className="rounded-full px-4 py-2 text-sm transition-all duration-200 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md"
                  >
                    Organizer view
                  </ToggleGroupItem>
                </ToggleGroup>
                {isViewingOwnProfile && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      console.log('Primary role action triggered');
                      primaryRoleAction.onClick();
                    }}
                    className="flex items-center gap-2 rounded-full px-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-md"
                  >
                    <PrimaryRoleIcon className="h-4 w-4" />
                    {primaryRoleAction.label}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {displayedStats.map((stat) => (
                <Card
                  key={`${activeView}-${stat.label}`}
                  className="border-border/50 bg-background/70 transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-1"
                >
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-semibold">{stat.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:px-8">
        <section className="w-full space-y-6 lg:w-2/3">
          <Card className="border-border/50 bg-background/80">
            <CardHeader className="flex items-center justify-between gap-2 sm:flex-row">
              <div>
                <CardTitle>Posts</CardTitle>
                <CardDescription>Moments shared by {profile.display_name}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {feedItems.length > 0 ? (
                feedItems.map((item) => (
                  <UserPostCard
                    key={item.item_id}
                    item={item}
                    onLike={(postId) => handleLike(postId)}
                    onComment={(postId) => handleComment(postId)}
                    onShare={(postId) => handleSharePost(postId)}
                    onEventClick={(eventId) => {
                      if (!eventId) return;
                      navigate(routes.event(eventId));
                    }}
                    onAuthorClick={(authorId) => {
                      if (!authorId) return;
                      navigate(`/u/${authorId}`);
                    }}
                    onCreatePost={() => {}}
                    onReport={handleReport}
                    onSoundToggle={() => {}}
                    onVideoToggle={() => {}}
                    onOpenTickets={(eventId) => {
                      if (!eventId) return;
                      navigate(routes.event(eventId));
                    }}
                    soundEnabled={false}
                    isVideoPlaying={false}
                  />
                ))
              ) : (
                <EmptyState isSelf={isViewingOwnProfile} />
              )}
            </CardContent>
          </Card>

          <div className="relative">
            {activeView === 'attendee' ? (
              <Card
                key="attendee-role-card"
                className="border-border/50 bg-background/80 transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-2"
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5" /> Recent tickets
                  </CardTitle>
                  <CardDescription>Events this user has attended most recently.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tickets.length > 0 ? (
                    tickets.slice(0, 3).map((ticket) => {
                      const event = ticket.events;
                      if (!event) return null;

                      return (
                        <button
                          type="button"
                          key={ticket.id}
                          onClick={() => navigate(routes.event(event.id))}
                          className="w-full rounded-2xl border border-border/40 bg-background/60 p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
                        >
                          <div className="flex gap-4">
                            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
                              <img
                                src={event.cover_image_url ?? DEFAULT_EVENT_COVER}
                                alt={event.title}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="font-semibold">{event.title}</p>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(event.start_at)}
                                </span>
                              </div>
                              <Badge
                                variant={ticket.status === 'redeemed' ? 'default' : 'secondary'}
                                className="capitalize"
                              >
                                {ticket.status ?? 'pending'}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">No ticket history yet.</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card
                key="organizer-role-card"
                className="border-border/50 bg-background/80 transition-all duration-300 animate-in fade-in-0 slide-in-from-bottom-2"
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" /> Dashboard
                  </CardTitle>
                  <CardDescription>Overview of your organized events and activity.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {events.length > 0 ? (
                    events.slice(0, 5).map((event) => (
                      <button
                        type="button"
                        key={event.id}
                        onClick={() => navigate(routes.event(event.id))}
                        className="w-full rounded-2xl border border-border/40 bg-background/60 p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
                      >
                        <div className="flex flex-col gap-2">
                          <p className="truncate font-semibold">{event.title}</p>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(event.start_at)}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No events to manage yet.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <aside className="w-full space-y-6 lg:w-1/3">
          <Card className="border-border/50 bg-background/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Profile details
              </CardTitle>
              <CardDescription>Quick access to contact and background information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Display name</p>
                <p className="font-medium">{profile.display_name}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Role</p>
                <p className="font-medium capitalize">{profile.role ?? 'attendee'}</p>
              </div>

              <div>
                <p className="text-muted-foreground">Phone</p>
                {profile.phone ? (
                  <a className="font-medium text-primary hover:underline" href={`tel:${profile.phone}`}>
                    {profile.phone}
                  </a>
                ) : (
                  <p className="font-medium">Not provided</p>
                )}
              </div>

              <div>
                <p className="text-muted-foreground">Social links</p>
                {profile.social_links.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.social_links.map((link) => (
                      <Button key={`${link.platform}-${link.url}`} size="sm" variant="outline" asChild>
                        <a href={link.url} target="_blank" rel="noreferrer">
                          {link.platform}
                        </a>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="font-medium">No social links added</p>
                )}
              </div>
            </CardContent>
          </Card>

          {activeView === 'organizer' && (
            <Card className="border-border/50 bg-background/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" /> Event Management
                </CardTitle>
                <CardDescription>Quick access to your organized events.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {events.length > 0 ? (
                  events.slice(0, 3).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => navigate(routes.event(event.id))}
                      className="w-full rounded-2xl border border-border/40 bg-background/60 p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
                    >
                      <p className="font-semibold">{event.title}</p>
                      <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" /> {formatDate(event.start_at)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="text-muted-foreground">No events to manage yet.</p>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </main>

      {/* Comment Modal */}
      {commentContext && (
        <CommentModal
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setCommentContext(null);
          }}
          postId={commentContext.postId}
          eventId={commentContext.eventId}
          eventTitle={commentContext.eventTitle}
          onCommentCountChange={(count) => {
            // Update local state to reflect new comment count
            setPosts((prevPosts) =>
              prevPosts.map((post) =>
                post.id === commentContext.postId
                  ? { ...post, comment_count: Number(count) }
                  : post
              )
            );
          }}
        />
      )}
    </div>
  );
}
