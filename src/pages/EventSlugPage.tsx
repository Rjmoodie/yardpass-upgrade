import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Play,
  Share2,
  Ticket,
  Users,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import {
  InfiniteData,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseEventIdentifier } from '@/lib/eventRouting';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, BottomSheetContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AccessGate } from '@/components/access/AccessGate';
import { useShare } from '@/hooks/useShare';
import { useInfiniteScroll } from '@/hooks/useIntersectionObserver';
import { useIsMobile } from '@/hooks/use-mobile';
import { shouldIndexEvent, buildEventShareUrl } from '@/lib/visibility';
import { stripHtml, sanitizeHtml } from '@/lib/security';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { isVideoUrl } from '@/utils/mux';
import { muxToPoster } from '@/utils/media';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';
import { UserPostCard } from '@/components/UserPostCard';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';

const safeOrigin =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://yardpass.app';

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
  address?: string | null;
  cover_image_url: string | null;
  owner_context_type: 'organization' | 'individual';
  owner_context_id: string;
  created_by: string;
  visibility: 'public' | 'unlisted' | 'private';
  link_token?: string | null;
  organizations?: {
    id: string;
    name: string;
    handle: string | null;
    logo_url: string | null;
  } | null;
  creator?: {
    user_id: string;
    display_name: string | null;
    photo_url: string | null;
  } | null;
};

type Attendee = {
  id: string;
  display_name: string | null;
  photo_url: string | null;
};

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
      `id, event_id, text, media_urls, like_count, comment_count, author_user_id, author_name, author_badge_label, author_is_organizer, created_at, viewer_has_liked` as const,
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
    nextCursor: hasMore && tail?.created_at && tail?.id
      ? { createdAt: tail.created_at, id: tail.id, limit }
      : undefined,
    totalCount: typeof count === 'number' ? count : undefined,
  };
}

function mapPostToFeedItem(
  post: EventPostWithMeta,
  event: EventRow,
  locationDisplay: string
): FeedItem {
  return {
    item_type: 'post',
    sort_ts: post.created_at ?? new Date().toISOString(),
    item_id: post.id,
    event_id: event.id,
    event_title: event.title,
    event_description: event.description ?? '',
    event_starts_at: event.start_at,
    event_cover_image: event.cover_image_url || DEFAULT_EVENT_COVER,
    event_organizer:
      event.organizations?.name ?? event.creator?.display_name ?? 'Organizer',
    event_organizer_id:
      event.owner_context_type === 'organization'
        ? event.organizations?.id ?? null
        : event.creator?.user_id ?? event.owner_context_id ?? null,
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

function GridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <Skeleton
          key={idx}
          className="aspect-square rounded-2xl border border-white/10 bg-white/5"
        />
      ))}
    </div>
  );
}

type GridEmptyProps = {
  title: string;
  description: string;
};

function GridEmptyState({ title, description }: GridEmptyProps) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/5 text-center">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[220px]">{description}</p>
    </div>
  );
}

type GridProps = {
  posts: EventPostWithMeta[];
  isLoading: boolean;
  loadingMore: boolean;
  onSelect: (post: EventPostWithMeta) => void;
  loadMoreRef?: (node: HTMLElement | null) => void;
  fallbackImage: string;
  emptyTitle: string;
  emptyDescription: string;
};

function EventPostGrid({
  posts,
  isLoading,
  loadingMore,
  onSelect,
  loadMoreRef,
  fallbackImage,
  emptyTitle,
  emptyDescription,
}: GridProps) {
  if (isLoading) {
    return <GridSkeleton />;
  }

  if (!posts.length) {
    return <GridEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
        {posts.map((post) => {
          const mediaUrl = post.media_urls?.[0] ?? null;
          const isVideo = Boolean(mediaUrl && isVideoUrl(mediaUrl));
          const posterUrl = isVideo ? muxToPoster(mediaUrl) : null;
          const preview = posterUrl || mediaUrl || fallbackImage;

          return (
            <button
              key={post.id}
              type="button"
              onClick={() => onSelect(post)}
              className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={post.author_name ? `View post from ${post.author_name}` : 'View post'}
            >
              {mediaUrl ? (
                <ImageWithFallback
                  src={preview}
                  alt={post.author_name ? `Post from ${post.author_name}` : 'Event post media'}
                  fallback={fallbackImage}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 to-white/10 px-4 text-center text-xs text-white/70">
                  {post.text ? post.text.slice(0, 120) : 'Post'}
                </div>
              )}

              {isVideo && (
                <div className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white">
                  <Play className="h-3.5 w-3.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div ref={loadMoreRef} />

      {loadingMore && <GridSkeleton count={3} />}
    </div>
  );
}

export default function EventSlugPage() {
  const { identifier: rawParam } = useParams() as { identifier: string };
  const { identifier } = parseEventIdentifier(rawParam);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { shareEvent, sharePost, isSharing } = useShare();
  const { toggleLike } = useOptimisticReactions();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'posts' | 'tagged'>('details');
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setLoading(true);
      try {
        let { data, error } = await supabase
          .from('events')
          .select(
            `
              id,
              slug,
              title,
              description,
              category,
              start_at,
              end_at,
              venue,
              city,
              country,
              address,
              cover_image_url,
              owner_context_type,
              owner_context_id,
              created_by,
              visibility,
              link_token,
              organizations:organizations!events_owner_context_id_fkey (id, name, handle, logo_url),
              creator:user_profiles!events_created_by_fkey (user_id, display_name, photo_url)
            `
          )
          .eq('slug', identifier)
          .limit(1);

        if ((!data || !data.length) && /^[0-9a-f-]{36}$/i.test(identifier)) {
          const byId = await supabase
            .from('events')
            .select(
              `
                id,
                slug,
                title,
                description,
                category,
                start_at,
                end_at,
                venue,
                city,
                country,
                address,
                cover_image_url,
                owner_context_type,
                owner_context_id,
                created_by,
                visibility,
                link_token,
                organizations:organizations!events_owner_context_id_fkey (id, name, handle, logo_url),
                creator:user_profiles!events_created_by_fkey (user_id, display_name, photo_url)
              `
            )
            .eq('id', identifier)
            .limit(1);
          data = byId.data;
          error = byId.error;
        }

        if (!isMounted) return;
        if (error) {
          console.error('Event fetch error:', error);
          setEvent(null);
          setLoading(false);
          return;
        }

        const eventRow = data?.[0] ?? null;
        setEvent(eventRow as EventRow | null);

        if (eventRow) {
          const [{ data: atts }, { count }] = await Promise.all([
            supabase
              .from('tickets')
              .select(
                'owner_user_id, user_profiles!tickets_owner_user_id_fkey(id, display_name, photo_url)'
              )
              .eq('event_id', eventRow.id)
              .in('status', ['issued', 'transferred', 'redeemed'])
              .limit(12),
            supabase
              .from('tickets')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', eventRow.id)
              .in('status', ['issued', 'transferred', 'redeemed']),
          ]);

          if (isMounted) {
            setAttendees(
              (atts || []).map((t: any) => ({
                id: t.user_profiles.id,
                display_name: t.user_profiles.display_name,
                photo_url: t.user_profiles.photo_url,
              }))
            );
            setAttendeeCount(count || 0);
          }
        }
      } catch (error) {
        console.error('Event fetch error:', error);
        if (isMounted) {
          setEvent(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [identifier]);

  const eventId = event?.id ?? null;

  const taggedQuery = useInfiniteQuery<EventPostPage, Error>({
    queryKey: ['eventProfilePosts', eventId, 'tagged'],
    queryFn: ({ pageParam }) =>
      fetchEventPostsPage(eventId!, 'tagged', pageParam as EventPostCursor | undefined),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(eventId),
    staleTime: 15_000,
  });

  const postsQuery = useInfiniteQuery<EventPostPage, Error>({
    queryKey: ['eventProfilePosts', eventId, 'posts'],
    queryFn: ({ pageParam }) =>
      fetchEventPostsPage(eventId!, 'posts', pageParam as EventPostCursor | undefined),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(eventId),
    staleTime: 15_000,
  });

  const taggedPosts = useMemo(
    () => taggedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [taggedQuery.data]
  );
  const organizerPosts = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [postsQuery.data]
  );

  const locationDisplay = useMemo(() => {
    if (!event) return 'Location TBA';
    const parts = [event.venue, event.city, event.country].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Location TBA';
  }, [event]);

  const headerWhen = useMemo(() => {
    if (!event?.start_at) return 'Date TBA';
    try {
      const start = new Date(event.start_at);
      const date = new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(start);
      const time = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(start);
      if (event.end_at) {
        const end = new Date(event.end_at);
        const endTime = new Intl.DateTimeFormat(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        }).format(end);
        return `${date} • ${time} – ${endTime}`;
      }
      return `${date} • ${time}`;
    } catch (err) {
      console.warn('Unable to format event date', err);
      return 'Date TBA';
    }
  }, [event?.start_at, event?.end_at]);

  const detailedDate = useMemo(() => {
    if (!event?.start_at) return 'Date TBA';
    try {
      const start = new Date(event.start_at);
      return new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(start);
    } catch {
      return 'Date TBA';
    }
  }, [event?.start_at]);

  const detailedTime = useMemo(() => {
    if (!event?.start_at) return 'Time TBA';
    try {
      const start = new Date(event.start_at);
      const startTime = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(start);
      if (event?.end_at) {
        const end = new Date(event.end_at);
        const endTime = new Intl.DateTimeFormat(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        }).format(end);
        return `${startTime} – ${endTime}`;
      }
      return startTime;
    } catch {
      return 'Time TBA';
    }
  }, [event?.start_at, event?.end_at]);

  const eventInitials = useMemo(() => {
    if (!event?.title) return 'EV';
    return event.title
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [event?.title]);

  const taggedCount = useMemo(() => taggedQuery.data?.pages?.[0]?.totalCount ?? null, [taggedQuery.data]);
  const postsCount = useMemo(() => postsQuery.data?.pages?.[0]?.totalCount ?? null, [postsQuery.data]);

  const taggedHasMore = Boolean(taggedQuery.hasNextPage);
  const postsHasMore = Boolean(postsQuery.hasNextPage);

  const handleTaggedLoadMore = useCallback(() => {
    if (taggedQuery.hasNextPage && !taggedQuery.isFetchingNextPage) {
      taggedQuery.fetchNextPage();
    }
  }, [taggedQuery]);

  const handlePostsLoadMore = useCallback(() => {
    if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) {
      postsQuery.fetchNextPage();
    }
  }, [postsQuery]);

  const taggedLoadMoreRef = useInfiniteScroll(
    taggedHasMore,
    taggedQuery.isFetchingNextPage,
    handleTaggedLoadMore
  );
  const postsLoadMoreRef = useInfiniteScroll(
    postsHasMore,
    postsQuery.isFetchingNextPage,
    handlePostsLoadMore
  );

  const taggedFeedMap = useMemo(() => {
    if (!event) return new Map<string, FeedItem>();
    return new Map(
      taggedPosts.map((post) => [post.id, mapPostToFeedItem(post, event, locationDisplay)])
    );
  }, [taggedPosts, event, locationDisplay]);

  const organizerFeedMap = useMemo(() => {
    if (!event) return new Map<string, FeedItem>();
    return new Map(
      organizerPosts.map((post) => [post.id, mapPostToFeedItem(post, event, locationDisplay)])
    );
  }, [organizerPosts, event, locationDisplay]);

  useEffect(() => {
    if (!selectedPost) return;
    const updated = taggedFeedMap.get(selectedPost.item_id) ?? organizerFeedMap.get(selectedPost.item_id);
    if (updated) {
      setSelectedPost((prev) => {
        if (!prev) return updated;
        if (prev.metrics.likes === updated.metrics.likes && prev.metrics.viewer_has_liked === updated.metrics.viewer_has_liked && prev.metrics.comments === updated.metrics.comments) {
          return prev;
        }
        return { ...prev, metrics: { ...prev.metrics, ...updated.metrics } };
      });
    }
  }, [selectedPost?.item_id, taggedFeedMap, organizerFeedMap]);

  const handleSelectPost = useCallback(
    (post: EventPostWithMeta) => {
      if (!event) return;
      const feedItem = taggedFeedMap.get(post.id) ?? organizerFeedMap.get(post.id);
      if (feedItem) {
        setSelectedPost(feedItem);
      }
    },
    [event, taggedFeedMap, organizerFeedMap]
  );

  const updateCachedPost = useCallback(
    (postId: string, updater: (item: EventPostWithMeta) => EventPostWithMeta) => {
      if (!eventId) return;

      const applyUpdate = (filter: EventPostFilter) => {
        const key = ['eventProfilePosts', eventId, filter] as const;
        queryClient.setQueryData<InfiniteData<EventPostPage>>(
          key,
          (data) => {
            if (!data) return data;
            return {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.map((item) =>
                  item.id === postId ? updater(item) : item
                ),
              })),
            };
          }
        );
      };

      applyUpdate('tagged');
      applyUpdate('posts');
    },
    [eventId, queryClient]
  );

  const handleLike = useCallback(
    async (postId: string) => {
      if (!selectedPost || selectedPost.item_id !== postId) return;
      const currentLiked = Boolean(selectedPost.metrics.viewer_has_liked);
      const currentLikes = Number(selectedPost.metrics.likes ?? 0);
      const result = await toggleLike(postId, currentLiked, currentLikes);
      if (!result.ok) return;

      setSelectedPost((prev) =>
        prev
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

      updateCachedPost(postId, (item) => ({
        ...item,
        like_count: result.likeCount,
        viewer_has_liked: result.isLiked,
      }));
    },
    [selectedPost, toggleLike, updateCachedPost]
  );

  const handleSharePost = useCallback(
    (postId: string) => {
      if (!selectedPost || selectedPost.item_id !== postId) return;
      const eventTitle = selectedPost.event_title || event?.title || 'Event';
      const text = selectedPost.content || undefined;
      sharePost(postId, eventTitle, text);
    },
    [selectedPost, sharePost, event?.title]
  );

  const handleAuthorClick = useCallback(
    (authorId: string) => {
      if (!authorId) return;
      setSelectedPost(null);
      navigate(`/u/${authorId}`);
    },
    [navigate]
  );

  const handleModalEventClick = useCallback(
    (eventIdToOpen: string) => {
      setSelectedPost(null);
      navigate(`/e/${event?.slug ?? eventIdToOpen}`);
    },
    [navigate, event?.slug]
  );

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
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

  const linkTokenFromUrl = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  ).get('k');
  const robotsNoIndex = event?.visibility && !shouldIndexEvent(event.visibility);

  const shareUrl = buildEventShareUrl({
    idOrSlug: event.slug ?? event.id,
    visibility: event.visibility as any,
    linkToken: event.visibility === 'unlisted' ? event.link_token ?? null : null,
  });

  const meta = buildMeta(event, headerWhen, `${safeOrigin}${shareUrl}`);

  const fullAddress = [event.venue, event.city, event.country]
    .filter(Boolean)
    .join(', ');

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

  const coverImage = event.cover_image_url || DEFAULT_EVENT_COVER;
  const hostName = event.organizations?.name ?? event.creator?.display_name ?? 'Host';
  const hostAvatar =
    event.organizations?.logo_url || event.creator?.photo_url || coverImage;
  const hostLink = event.organizations
    ? `/org/${event.organizations.handle ?? event.organizations.id}`
    : event.creator
    ? `/u/${event.creator.user_id}`
    : undefined;

  return (
    <>
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <link rel="canonical" href={meta.canonical} />
        {robotsNoIndex && <meta name="robots" content="noindex,nofollow" />}
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:type" content={meta.ogType} />
        <meta property="og:url" content={meta.canonical} />
        {meta.image && <meta property="og:image" content={meta.image} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        {meta.image && <meta name="twitter:image" content={meta.image} />}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <AccessGate
        eventId={event.id}
        visibility={event.visibility as any}
        linkTokenFromUrl={linkTokenFromUrl}
        onTokenAccepted={() => {
          /* no-op */
        }}
      >
        <div className="pb-20">
          <div className="relative h-64 w-full overflow-hidden">
            <ImageWithFallback
              src={coverImage}
              alt={event.title}
              className="h-full w-full object-cover"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          </div>

          <div className="mx-auto -mt-20 max-w-5xl px-4">
            <Card className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Avatar className="h-20 w-20 border-2 border-white/20">
                      <AvatarImage src={hostAvatar} alt={hostName} />
                      <AvatarFallback>{eventInitials}</AvatarFallback>
                    </Avatar>

                    <div className="space-y-2">
                      {event.category && (
                        <Badge variant="secondary" className="uppercase tracking-wide">
                          {event.category}
                        </Badge>
                      )}
                      <h1 className="text-2xl font-semibold leading-tight text-white md:text-3xl">
                        {event.title}
                      </h1>
                      <div className="flex flex-col gap-1 text-sm text-white/70">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{headerWhen}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{locationDisplay}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                      onClick={() => shareEvent(event.id, event.title)}
                      disabled={isSharing}
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                    <Button
                      className="flex items-center gap-2"
                      onClick={() => setShowTicketModal(true)}
                    >
                      <Ticket className="h-4 w-4" />
                      Get Tickets
                    </Button>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-2xl font-semibold text-white">
                        {taggedCount ?? taggedPosts.length}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-white/60">Tagged</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-semibold text-white">
                        {postsCount ?? organizerPosts.length}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-white/60">Posts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-semibold text-white">{attendeeCount}</p>
                      <p className="text-xs uppercase tracking-wide text-white/60">Going</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex -space-x-2">
                      {attendees.slice(0, 6).map((attendee) => (
                        <Avatar
                          key={attendee.id}
                          className="h-8 w-8 border-2 border-background"
                        >
                          <AvatarImage src={attendee.photo_url ?? undefined} alt={attendee.display_name ?? 'Attendee'} />
                          <AvatarFallback>
                            {attendee.display_name?.[0]?.toUpperCase() ?? 'Y'}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {attendees.length === 0 && (
                        <span className="text-xs text-white/60">Be the first to attend</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start text-white/80 hover:text-white"
                      onClick={() => navigate(`/e/${event.slug ?? event.id}/attendees`)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      See attendees
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mx-auto mt-10 max-w-5xl px-4">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
              <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-black/20 backdrop-blur-sm border border-white/10 p-1 text-white">
                <TabsTrigger value="details" className="rounded-xl text-sm font-medium data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/80 hover:text-white transition-colors">
                  Details
                </TabsTrigger>
                <TabsTrigger value="posts" className="rounded-xl text-sm font-medium data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/80 hover:text-white transition-colors">
                  Posts{typeof postsCount === 'number' ? ` (${postsCount})` : ''}
                </TabsTrigger>
                <TabsTrigger value="tagged" className="rounded-xl text-sm font-medium data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/80 hover:text-white transition-colors">
                  Tagged{typeof taggedCount === 'number' ? ` (${taggedCount})` : ''}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-6">
                <div className="grid gap-6 md:grid-cols-[2fr,1.1fr]">
                  <Card className="rounded-3xl border border-white/10 bg-white/5">
                    <CardContent className="p-6">
                      <h2 className="text-lg font-semibold text-white">About this event</h2>
                      <div
                        className="prose prose-sm mt-3 max-w-none text-white/80"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(event.description || 'Details coming soon.'),
                        }}
                      />
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    <Card className="rounded-3xl border border-white/10 bg-white/5">
                      <CardContent className="space-y-4 p-6 text-sm text-white/80">
                        <div className="flex items-start gap-3">
                          <Calendar className="mt-0.5 h-5 w-5 text-primary" />
                          <div>
                            <p className="text-sm font-semibold text-white">When</p>
                            <p>{detailedDate}</p>
                            <p className="mt-1 flex items-center gap-2 text-white/70">
                              <Clock className="h-4 w-4" />
                              {detailedTime}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <MapPin className="mt-0.5 h-5 w-5 text-primary" />
                          <div>
                            <p className="text-sm font-semibold text-white">Where</p>
                            <p>{locationDisplay}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border border-white/10 bg-white/5">
                      <CardContent className="flex items-center gap-4 p-6">
                        <Avatar className="h-12 w-12 border border-white/10">
                          <AvatarImage src={hostAvatar} alt={hostName} />
                          <AvatarFallback>{eventInitials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">Hosted by</p>
                          {hostLink ? (
                            <Link
                              to={hostLink}
                              className="text-sm text-primary hover:underline"
                            >
                              {hostName}
                            </Link>
                          ) : (
                            <p className="text-sm text-white/80">{hostName}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="posts" className="mt-6">
                <EventPostGrid
                  posts={organizerPosts}
                  isLoading={postsQuery.isLoading && !organizerPosts.length}
                  loadingMore={postsQuery.isFetchingNextPage}
                  onSelect={handleSelectPost}
                  loadMoreRef={postsHasMore ? (postsLoadMoreRef as any) : undefined}
                  fallbackImage={coverImage}
                  emptyTitle="Host has no posts yet"
                  emptyDescription="Organizers can post updates, teasers, and behind-the-scenes moments."
                />
              </TabsContent>

              <TabsContent value="tagged" className="mt-6">
                <EventPostGrid
                  posts={taggedPosts}
                  isLoading={taggedQuery.isLoading && !taggedPosts.length}
                  loadingMore={taggedQuery.isFetchingNextPage}
                  onSelect={handleSelectPost}
                  loadMoreRef={taggedHasMore ? (taggedLoadMoreRef as any) : undefined}
                  fallbackImage={coverImage}
                  emptyTitle="No tagged posts yet"
                  emptyDescription="When attendees share memories from this event, they'll appear here."
                />
              </TabsContent>
            </Tabs>
          </div>

          <Dialog
            open={Boolean(selectedPost)}
            onOpenChange={(open) => {
              if (!open) setSelectedPost(null);
            }}
          >
            {selectedPost ? (
              isMobile ? (
                <BottomSheetContent className="max-h-[90vh] overflow-y-auto">
                  <UserPostCard
                    item={selectedPost}
                    onLike={(postId) => handleLike(postId)}
                    onComment={() => {}}
                    onShare={(postId) => handleSharePost(postId)}
                    onEventClick={handleModalEventClick}
                    onAuthorClick={handleAuthorClick}
                    onCreatePost={() => {}}
                    onReport={() => {}}
                    onSoundToggle={() => {}}
                    onVideoToggle={() => {}}
                    onOpenTickets={() => setShowTicketModal(true)}
                    soundEnabled={false}
                    isVideoPlaying={false}
                  />
                </BottomSheetContent>
              ) : (
                <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
                  <UserPostCard
                    item={selectedPost}
                    onLike={(postId) => handleLike(postId)}
                    onComment={() => {}}
                    onShare={(postId) => handleSharePost(postId)}
                    onEventClick={handleModalEventClick}
                    onAuthorClick={handleAuthorClick}
                    onCreatePost={() => {}}
                    onReport={() => {}}
                    onSoundToggle={() => {}}
                    onVideoToggle={() => {}}
                    onOpenTickets={() => setShowTicketModal(true)}
                    soundEnabled={false}
                    isVideoPlaying={false}
                  />
                </DialogContent>
              )
            ) : null}
          </Dialog>

          <EventTicketModal
            event={
              event
                ? {
                    id: event.id,
                    title: event.title,
                    start_at: event.start_at || '',
                    venue: event.venue || undefined,
                    address: fullAddress,
                    description: stripHtml(event.description) || undefined,
                  }
                : null
            }
            isOpen={showTicketModal}
            onClose={() => setShowTicketModal(false)}
            onSuccess={() => {
              setShowTicketModal(false);
            }}
          />
        </div>
      </AccessGate>
    </>
  );
}
