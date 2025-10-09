import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  lazy,
  Suspense,
} from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Share2, Users, Ticket, Play } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { parseEventIdentifier } from '@/lib/eventRouting';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { sharePayload } from '@/lib/share';
import { buildShareUrl, getShareTitle, getShareText } from '@/lib/shareLinks';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AccessGate } from '@/components/access/AccessGate';
import { shouldIndexEvent, buildEventShareUrl } from '@/lib/visibility';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useInfiniteScroll } from '@/hooks/useIntersectionObserver';
import { useIsMobile } from '@/hooks/use-mobile';
import { UserPostCard } from '@/components/UserPostCard';
import { useShare } from '@/hooks/useShare';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { isVideoUrl } from '@/utils/mux';
import { muxToPoster } from '@/utils/media';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';

const MapCard = lazy(() => import('@/components/maps/MapCard'));

type EventRow = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  category: string | null;
  start_at: string | null;
  end_at: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  cover_image_url: string | null;
  owner_context_type: 'organization' | 'individual';
  owner_context_id: string;
  visibility: 'public' | 'unlisted' | 'private';
  link_token?: string | null;
  organizations?: { id: string; name: string; handle: string | null } | null;
};

type Attendee = { id: string; display_name: string | null; photo_url: string | null };

const PAGE_SIZE = 12;

type EventPostFilter = 'tagged' | 'posts';

type EventPostCursor = {
  createdAt: string;
  id: string;
  limit?: number;
};

type EventPostWithMeta = {
  id: string;
  event_id: string | null;
  text: string | null;
  media_urls: string[] | null;
  like_count: number | null;
  comment_count: number | null;
  author_user_id: string | null;
  author_name: string | null;
  author_badge_label: string | null;
  author_is_organizer: boolean | null;
  created_at: string | null;
  viewer_has_liked?: boolean | null;
};

type EventPostPage = {
  items: EventPostWithMeta[];
  nextCursor?: EventPostCursor;
  totalCount?: number | null;
};

// ----------------- small helpers -----------------
const safeOrigin =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://yardpass.app'; // fallback to your prod origin if SSR or during build

// Import security utilities instead of local implementation
import { stripHtml, sanitizeHtml } from '@/lib/security';

function truncate(s: string, n = 160) {
  if (!s) return '';
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function buildMeta(ev: EventRow, whenText: string | null, canonical: string) {
  const title = ev?.title ? `${ev.title}${ev.city ? ` — ${ev.city}` : ''}` : 'Event';
  const loc = [ev.venue, ev.city, ev.country].filter(Boolean).join(', ');
  const baseDesc =
    stripHtml(ev.description) ||
    [whenText || 'Date TBA', loc || 'Location TBA'].filter(Boolean).join(' • ');
  const description = truncate(baseDesc, 180);

  return {
    title,
    description,
    canonical,
    ogType: 'website' as const,
    image: ev.cover_image_url || undefined,
  };
}

async function fetchEventPostsPage(
  eventId: string,
  filter: EventPostFilter,
  cursor?: EventPostCursor
): Promise<EventPostPage> {
  const limit = cursor?.limit ?? PAGE_SIZE;
  const query = supabase
    .from('event_posts_with_meta')
    .select(
      `id, event_id, text, media_urls, like_count, comment_count, author_user_id, author_name, author_badge_label, author_is_organizer, created_at, viewer_has_liked`,
      { count: 'exact' }
    )
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (filter === 'posts') {
    query.eq('author_badge_label', 'ORGANIZER');
  } else {
    query.or('author_badge_label.neq.ORGANIZER,author_badge_label.is.null');
  }

  if (cursor?.createdAt) {
    query.lt('created_at', cursor.createdAt);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as EventPostWithMeta[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const tail = items[items.length - 1];

  return {
    items,
    nextCursor:
      hasMore && tail?.created_at && tail?.id
        ? { createdAt: tail.created_at, id: tail.id, limit }
        : undefined,
    totalCount: typeof count === 'number' ? count : undefined,
  };
}

function mapPostToFeedItem(
  post: EventPostWithMeta,
  event: EventRow,
  locationDisplay: string
): Extract<FeedItem, { item_type: 'post' }> {
  return {
    item_type: 'post',
    sort_ts: post.created_at ?? new Date().toISOString(),
    item_id: post.id,
    event_id: event.id,
    event_title: event.title,
    event_description: event.description ?? '',
    event_starts_at: event.start_at ?? null,
    event_cover_image: event.cover_image_url ?? DEFAULT_EVENT_COVER,
    event_organizer: event.organizations?.name ?? '',
    event_organizer_id: event.organizations?.id ?? null,
    event_owner_context_type: event.owner_context_type,
    event_location: locationDisplay,
    author_id: post.author_user_id,
    author_name: post.author_name,
    author_badge: post.author_badge_label,
    author_social_links: null,
    media_urls: post.media_urls ?? [],
    content: post.text,
    metrics: {
      likes: post.like_count ?? 0,
      comments: post.comment_count ?? 0,
      viewer_has_liked: Boolean(post.viewer_has_liked),
    },
    sponsor: null,
    sponsors: null,
    promotion: null,
  };
}

type EventPostsGridProps = {
  event: EventRow;
  filter: EventPostFilter;
  locationDisplay: string;
  onSelectPost: (post: Extract<FeedItem, { item_type: 'post' }>) => void;
  isActive: boolean;
};

function EventPostsGrid({ event, filter, locationDisplay, onSelectPost, isActive }: EventPostsGridProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery<EventPostPage, Error>({
    queryKey: ['event-posts', event.id, filter],
    queryFn: ({ pageParam }) =>
      fetchEventPostsPage(event.id, filter, pageParam as EventPostCursor | undefined),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isActive && Boolean(event.id),
    initialPageParam: undefined,
    staleTime: 1000 * 30,
  });

  const posts = data?.pages.flatMap((page) => page.items) ?? [];
  const totalCount = data?.pages?.[0]?.totalCount ?? null;
  const hasMore = Boolean(hasNextPage) && isActive;
  const loadMoreRef = useInfiniteScroll(
    hasMore,
    Boolean(isFetchingNextPage),
    () => {
      if (hasNextPage) {
        void fetchNextPage();
      }
    },
    '200px'
  ) as React.MutableRefObject<HTMLDivElement | null>;

  const isLoading = isActive && status === 'pending';
  const isError = isActive && status === 'error';
  const isEmpty = isActive && status === 'success' && posts.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filter === 'posts' ? 'Organizer posts' : 'Tagged posts'}
          {typeof totalCount === 'number' ? ` · ${totalCount}` : ''}
        </span>
      </div>

      {isError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          {(error as Error)?.message || 'Unable to load posts right now.'}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <PostSkeleton key={idx} />
          ))}
        </div>
      ) : null}

      {!isLoading && !isEmpty ? (
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {posts.map((post) => (
            <EventPostTile
              key={post.id}
              post={post}
              onClick={() => onSelectPost(mapPostToFeedItem(post, event, locationDisplay))}
            />
          ))}
        </div>
      ) : null}

      {isEmpty ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-muted-foreground">
          {filter === 'posts'
            ? 'No posts from the host yet. Check back soon!'
            : 'No tagged posts yet. Be the first to share your experience.'}
        </div>
      ) : null}

      <div ref={isActive ? loadMoreRef : undefined} />

      {isFetchingNextPage ? (
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <PostSkeleton key={`fetching-${idx}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EventPostTile({
  post,
  onClick,
}: {
  post: EventPostWithMeta;
  onClick: () => void;
}) {
  const mediaUrl = post.media_urls?.[0] ?? null;
  const video = Boolean(mediaUrl && isVideoUrl(mediaUrl));
  const displayUrl = mediaUrl
    ? video
      ? muxToPoster(mediaUrl) ?? mediaUrl
      : mediaUrl
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-primary/60"
    >
      {displayUrl ? (
        <ImageWithFallback
          src={displayUrl}
          alt={post.text ?? 'Event post media'}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
          No media
        </div>
      )}
      {video && (
        <div className="absolute bottom-2 right-2 rounded-full bg-black/70 p-1 text-white shadow-lg">
          <Play className="h-4 w-4" />
        </div>
      )}
    </button>
  );
}

function PostSkeleton() {
  return <Skeleton className="aspect-square w-full rounded-xl bg-white/5" />;
}

export default function EventSlugPage() {
  const { identifier: rawParam } = useParams() as { identifier: string };
  const navigate = useNavigate();
  const { identifier } = parseEventIdentifier(rawParam);
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeCount, setAttendeeCount] = useState<number>(0);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Fetch event by slug OR id
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);

      try {
        // 1) event by slug
        let { data, error } = await supabase
          .from('events')
          .select(`
            id, slug, title, description, category, start_at, end_at, venue, city, country, cover_image_url,
            owner_context_type, owner_context_id, visibility, link_token,
            organizations:organizations!events_owner_context_id_fkey(id, name, handle)
          `)
          .eq('slug', identifier)
          .limit(1);

        // if not found and looks like UUID, try by id
        if ((!data || !data.length) && /^[0-9a-f-]{36}$/i.test(identifier)) {
          const byId = await supabase
            .from('events')
            .select(`
              id, slug, title, description, category, start_at, end_at, venue, city, country, cover_image_url,
              owner_context_type, owner_context_id, visibility, link_token,
              organizations:organizations!events_owner_context_id_fkey(id, name, handle)
            `)
            .eq('id', identifier)
            .limit(1);
          data = byId.data;
          error = byId.error;
        }

        if (!isMounted) return;
        if (error) {
          setLoading(false);
          return;
        }

        const ev = data?.[0] ?? null;
        setEvent(ev);

        if (ev) {
          // attendees preview (first 12) + total count
          const [{ data: atts }, { count }] = await Promise.all([
            supabase
              .from('tickets')
              .select('owner_user_id, user_profiles!tickets_owner_user_id_fkey(id, display_name, photo_url)')
              .eq('event_id', ev.id)
              .in('status', ['issued', 'transferred', 'redeemed'])
              .limit(12),
            supabase
              .from('tickets')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', ev.id)
              .in('status', ['issued', 'transferred', 'redeemed']),
          ]);

          setAttendees(
            (atts || []).map((t: any) => ({
              id: t.user_profiles.id,
              display_name: t.user_profiles.display_name,
              photo_url: t.user_profiles.photo_url,
            }))
          );
          setAttendeeCount(count || 0);
        }
        setLoading(false);
      } catch (error) {
        console.error('Event fetch error:', error);
        setEvent(null);
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [identifier]);

  const when = useMemo(() => {
    if (!event?.start_at) return null;
    try {
      const start = new Date(event.start_at);
      return start.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  }, [event?.start_at]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        Event not found
      </div>
    );
  }

  // Get access token from URL and determine SEO settings
  const linkTokenFromUrl = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('k');
  const robotsNoIndex = event?.visibility && !shouldIndexEvent(event.visibility);

  // Build proper share URL with access token for unlisted events
  const shareUrl = buildEventShareUrl({
    idOrSlug: event.slug ?? event.id,
    visibility: event.visibility as any,
    linkToken: event.visibility === 'unlisted' ? event.link_token ?? null : null,
  });

  // Construct address with better validation
  const fullAddress = [event.venue, event.city, event.country].filter(Boolean).join(', ') || '';
  const hasMappable = Boolean(event.city || event.venue || event.country);

  const meta = buildMeta(event, when, `${safeOrigin}${shareUrl}`);
  const locationDisplay = fullAddress || 'Location TBA';

  const [activeTab, setActiveTab] = useState<'details' | EventPostFilter>('details');
  const [selectedPost, setSelectedPost] =
    useState<Extract<FeedItem, { item_type: 'post' }> | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { sharePost } = useShare();
  const { toggleLike } = useOptimisticReactions();

  const handleSelectPost = useCallback(
    (post: Extract<FeedItem, { item_type: 'post' }>) => {
      setSelectedPost(post);
      setViewerOpen(true);
    },
    []
  );

  const handleModalLike = useCallback(
    async (postId: string) => {
      if (!selectedPost || selectedPost.item_id !== postId) return;

      const result = await toggleLike(
        postId,
        Boolean(selectedPost.metrics?.viewer_has_liked),
        selectedPost.metrics?.likes ?? 0
      );

      if (result.ok) {
        setSelectedPost((prev) =>
          prev && prev.item_id === postId
            ? {
                ...prev,
                metrics: {
                  ...prev.metrics,
                  likes: result.likeCount,
                  viewer_has_liked: result.isLiked,
                },
              }
            : prev
        );

        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === 'event-posts' &&
            query.queryKey[1] === event.id,
        });
      }
    },
    [selectedPost, toggleLike, queryClient, event.id]
  );

  const handleModalShare = useCallback(() => {
    if (!selectedPost) return;
    void sharePost(selectedPost.item_id, event.title, selectedPost.content ?? undefined);
  }, [selectedPost, sharePost, event.title]);

  const handleModalEventClick = useCallback(
    (_eventId?: string) => {
      setViewerOpen(false);
      navigate(`/e/${event.slug ?? event.id}`);
    },
    [navigate, event.slug, event.id]
  );

  // Build JSON-LD
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    startDate: event.start_at || undefined,
    endDate: event.end_at || undefined,
    image: event.cover_image_url ? [event.cover_image_url] : undefined,
    description: stripHtml(event.description),
    location: fullAddress
      ? {
          '@type': 'Place',
          name: event.venue || undefined,
          address: {
            '@type': 'PostalAddress',
            streetAddress: event.venue || undefined,
            addressLocality: event.city || undefined,
            addressCountry: event.country || undefined,
          },
        }
      : undefined,
    organizer: event.organizations
      ? {
          '@type': 'Organization',
          name: event.organizations.name,
          url: `${safeOrigin}/org/${event.organizations.handle ?? event.organizations.id}`,
        }
      : undefined,
    url: `${safeOrigin}${shareUrl}`,
  };

  return (
    <>
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <link rel="canonical" href={meta.canonical} />
        {robotsNoIndex && <meta name="robots" content="noindex,nofollow" />}
        
        {/* Open Graph */}
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:type" content={meta.ogType} />
        <meta property="og:url" content={meta.canonical} />
        {meta.image && <meta property="og:image" content={meta.image} />}
        
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        {meta.image && <meta name="twitter:image" content={meta.image} />}
        
        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <AccessGate
        eventId={event.id}
        visibility={event.visibility as any}
        linkTokenFromUrl={linkTokenFromUrl}
        onTokenAccepted={() => {
          // Optional: refetch if needed, but AccessGate handles the flow
        }}
      >
        <div className="pb-20">

      {/* COVER */}
      {event.cover_image_url ? (
        <div className="relative">
          <ImageWithFallback
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-64 object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
      ) : null}

      {/* HEADER */}
      <div className="max-w-3xl mx-auto px-4 -mt-12 relative">
        <Card className="shadow-lg">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  {event.category ? (
                    <Badge variant="secondary" className="mb-2">
                      {event.category}
                    </Badge>
                  ) : null}
                  <h1 className="text-xl md:text-2xl font-semibold leading-tight">
                    {event.title}
                  </h1>
                  <div className="mt-2 text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{when ?? 'Date TBA'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>{locationDisplay}</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    sharePayload({
                      title: getShareTitle({
                        type: 'event',
                        slug: event.slug ?? event.id,
                        title: event.title,
                      }),
                      text: getShareText({
                        type: 'event',
                        slug: event.slug ?? event.id,
                        title: event.title,
                        city: event.city ?? undefined,
                        date: when ?? undefined,
                      }),
                      url: buildShareUrl({
                        type: 'event',
                        slug: event.slug ?? event.id,
                        title: event.title || '',
                      }),
                    });
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>

              {/* GET TICKETS BUTTON */}
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  setShowTicketModal(true);
                }}
              >
                <Ticket className="w-5 h-5 mr-2" />
                Get Tickets
              </Button>

              {/* WHO'S GOING */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex -space-x-2 overflow-hidden">
                  {attendees.map((a) => (
                    <img
                      key={a.id}
                      src={a.photo_url || ''}
                      alt={a.display_name || 'attendee'}
                      className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover bg-muted"
                      onError={(e) =>
                        ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')
                      }
                      loading="lazy"
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/e/${event.slug ?? event.id}/attendees`)}
                >
                  <Users className="w-4 h-4 mr-2" />
                  See who's going {attendeeCount ? `(${attendeeCount})` : ''}
                </Button>
              </div>

              {/* ORGANIZER LINK */}
              {event.organizations ? (
                <div className="text-sm">
                  Hosted by{' '}
                  <Link
                    to={`/org/${event.organizations.handle ?? event.organizations.id}`}
                    className="font-medium underline underline-offset-2"
                  >
                    {event.organizations.name}
                  </Link>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-8">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'details' | EventPostFilter)}
          className="space-y-6"
        >
          <div className="flex justify-center">
            <TabsList className="grid w-full grid-cols-3 gap-2 rounded-full border border-white/10 bg-white/5 p-1 sm:w-auto">
              <TabsTrigger
                value="details"
                className="rounded-full text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white"
              >
                Details
              </TabsTrigger>
              <TabsTrigger
                value="posts"
                className="rounded-full text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white"
              >
                Posts
              </TabsTrigger>
              <TabsTrigger
                value="tagged"
                className="rounded-full text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white"
              >
                Tagged
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className="space-y-6 focus:outline-none">
            {hasMappable && (
              <Suspense
                fallback={<div className="h-64 w-full animate-pulse rounded-2xl bg-muted/40" />}
              >
                <MapCard
                  address={fullAddress}
                  title={event.title}
                  height={280}
                  showControls={false}
                />
              </Suspense>
            )}

            {event.description ? (
              <Card>
                <CardContent className="p-5">
                  <h2 className="text-lg font-semibold mb-3">About this event</h2>
                  <div
                    className="prose prose-sm max-w-none text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(event.description) }}
                  />
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardContent className="p-5">
                <h2 className="text-lg font-semibold mb-4">Event Details</h2>
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  {event.start_at && (
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">Date & Time</div>
                        <div className="text-muted-foreground">
                          {new Date(event.start_at).toLocaleDateString(undefined, {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </div>
                        <div className="text-muted-foreground">
                          {new Date(event.start_at).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                          {event.end_at &&
                            ` - ${new Date(event.end_at).toLocaleTimeString(undefined, {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })}`}
                        </div>
                      </div>
                    </div>
                  )}

                  {fullAddress && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">Location</div>
                        <div className="text-muted-foreground">{fullAddress}</div>
                      </div>
                    </div>
                  )}

                  {event.category && (
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                      <div>
                        <div className="font-medium">Category</div>
                        <div className="text-muted-foreground">{event.category}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <div className="font-medium">Attendees</div>
                      <div className="text-muted-foreground">
                        {attendeeCount > 0 ? `${attendeeCount} going` : 'Be the first to attend'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="focus:outline-none">
            <EventPostsGrid
              event={event}
              filter="posts"
              locationDisplay={locationDisplay}
              onSelectPost={handleSelectPost}
              isActive={activeTab === 'posts'}
            />
          </TabsContent>

          <TabsContent value="tagged" className="focus:outline-none">
            <EventPostsGrid
              event={event}
              filter="tagged"
              locationDisplay={locationDisplay}
              onSelectPost={handleSelectPost}
              isActive={activeTab === 'tagged'}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* EVENT TICKET MODAL */}
      <EventTicketModal
        event={event ? {
          id: event.id,
          title: event.title,
          start_at: event.start_at || '',
          venue: event.venue || undefined,
          address: fullAddress,
          description: stripHtml(event.description) || undefined
        } : null}
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onSuccess={() => {
          setShowTicketModal(false);
          // Optionally refresh attendee count
        }}
        />

        <Dialog
          open={viewerOpen}
          onOpenChange={(open) => {
            setViewerOpen(open);
            if (!open) {
              setSelectedPost(null);
            }
          }}
        >
          <DialogContent
            className={`w-full max-w-3xl overflow-hidden bg-background p-0 ${
              isMobile ? 'max-h-[90vh]' : ''
            }`}
          >
            {selectedPost ? (
              <div className={`${isMobile ? 'max-h-[80vh]' : 'max-h-[70vh]'} overflow-y-auto`}>
                <UserPostCard
                  item={selectedPost}
                  onLike={(postId) => {
                    void handleModalLike(postId);
                  }}
                  onComment={() => {}}
                  onShare={() => handleModalShare()}
                  onEventClick={(eventId) => handleModalEventClick(eventId)}
                  onOpenTickets={() => {
                    setViewerOpen(false);
                    setShowTicketModal(true);
                  }}
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
        </div>

      </AccessGate>
    </>
  );
}