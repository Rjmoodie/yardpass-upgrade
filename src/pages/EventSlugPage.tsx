import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, Copy, MapPin, Navigation, Play, Share2, Ticket, Users } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseEventIdentifier } from '@/lib/eventRouting';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, BottomSheetContent } from '@/components/ui/dialog';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AccessGate } from '@/components/access/AccessGate';
import { useShare } from '@/hooks/useShare';
import { useInfiniteScroll } from '@/hooks/useIntersectionObserver';
import { useEventSlug } from '@/hooks/useEventSlug';
import { EventSlugDisplay } from '@/components/ui/slug-display';
import { useIsMobile } from '@/hooks/use-mobile';
import { shouldIndexEvent, buildEventShareUrl } from '@/lib/visibility';
import { stripHtml, sanitizeHtml } from '@/lib/security';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';
import { UserPostCard } from '@/components/UserPostCard';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { isVideoUrl, muxToPoster } from '@/utils/mux';
import MapboxEventMap from '@/components/MapboxEventMap';
import CommentModal from '@/components/CommentModal';

/**
 * Enhanced design version: consistent dark theme, higher contrast, glass surfaces,
 * clear visual hierarchy and spacing rhythm. No functionality changes.
 */

const safeOrigin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://yardpass.app';
const PAGE_SIZE = 12;

type EventPostFilter = 'tagged' | 'posts';

type EventPostCursor = { createdAt: string; id: string; limit?: number };

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

type EventPostPage = { items: EventPostWithMeta[]; nextCursor?: EventPostCursor; totalCount?: number | null };

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
  lat: number | null;
  lng: number | null;
  cover_image_url: string | null;
  owner_context_type: 'organization' | 'individual';
  owner_context_id: string;
  created_by: string;
  visibility: 'public' | 'unlisted' | 'private';
  link_token?: string | null;
  organizations?: { id: string; name: string; handle: string | null; logo_url: string | null } | null;
  creator?: { user_id: string; display_name: string | null; photo_url: string | null } | null;
};

type Attendee = { id: string; display_name: string | null; photo_url: string | null };

function truncate(s: string, n = 160) { if (!s) return ''; return s.length <= n ? s : `${s.slice(0, n - 1)}…`; }

function buildMeta(ev: EventRow, whenText: string | null, canonical: string) {
  const title = ev?.title ? `${ev.title}${ev.city ? ` — ${ev.city}` : ''}` : 'Event';
  const loc = [ev.venue, ev.city, ev.country].filter(Boolean).join(', ');
  const baseDesc = stripHtml(ev.description) || [whenText || 'Date TBA', loc || 'Location TBA'].filter(Boolean).join(' • ');
  const description = truncate(baseDesc, 180);
  return { title, description, canonical, ogType: 'website' as const, image: ev.cover_image_url || undefined };
}

async function fetchEventPostsPage(eventId: string, filter: EventPostFilter, cursor?: EventPostCursor): Promise<EventPostPage> {
  const limit = cursor?.limit ?? PAGE_SIZE;
  const query = supabase
    .from('event_posts_with_meta')
    .select(
      'id, event_id, text, media_urls, like_count, comment_count, author_user_id, author_name, author_badge_label, author_is_organizer, created_at, viewer_has_liked',
      { count: 'exact' }
    )
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (filter === 'posts') query.eq('author_badge_label', 'ORGANIZER');
  else query.or('author_badge_label.neq.ORGANIZER,author_badge_label.is.null');

  if (cursor?.createdAt) query.lt('created_at', cursor.createdAt);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as EventPostWithMeta[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const tail = items[items.length - 1];
  return { items, nextCursor: hasMore && tail?.created_at && tail?.id ? { createdAt: tail.created_at, id: tail.id, limit } : undefined, totalCount: typeof count === 'number' ? count : undefined };
}

function mapPostToFeedItem(post: EventPostWithMeta, event: EventRow, locationDisplay: string): FeedItem {
  return {
    item_type: 'post',
    sort_ts: post.created_at ?? new Date().toISOString(),
    item_id: post.id,
    event_id: event.id,
    event_title: event.title,
    event_description: event.description ?? '',
    event_starts_at: event.start_at,
    event_cover_image: event.cover_image_url || DEFAULT_EVENT_COVER,
    event_organizer: event.organizations?.name ?? event.creator?.display_name ?? 'Organizer',
    event_organizer_id: event.owner_context_type === 'organization' ? event.organizations?.id ?? null : event.creator?.user_id ?? event.owner_context_id ?? null,
    event_owner_context_type: event.owner_context_type,
    event_location: locationDisplay,
    author_id: post.author_user_id,
    author_name: post.author_name,
    author_badge: post.author_badge_label,
    author_social_links: null,
    media_urls: post.media_urls ?? [],
    content: post.text,
    metrics: { likes: post.like_count ?? 0, comments: post.comment_count ?? 0, viewer_has_liked: Boolean(post.viewer_has_liked) },
    sponsor: null,
    sponsors: null,
    promotion: null,
  };
}

function GridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <Skeleton key={idx} className="aspect-square rounded-2xl border border-border/50 bg-card/50" />
      ))}
    </div>
  );
}

function GridEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 bg-card/50 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-[260px] text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function EventPostGrid({ posts, isLoading, loadingMore, onSelect, loadMoreRef, fallbackImage, emptyTitle, emptyDescription }: {
  posts: EventPostWithMeta[];
  isLoading: boolean;
  loadingMore: boolean;
  onSelect: (post: EventPostWithMeta) => void;
  loadMoreRef?: (node: HTMLElement | null) => void;
  fallbackImage: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (isLoading) return <GridSkeleton />;
  if (!posts.length) return <GridEmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-4">
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
              className="relative aspect-square overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-b from-card/50 to-card/30 shadow-sm ring-1 ring-black/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-label={post.author_name ? `View post from ${post.author_name}` : 'View post'}
            >
              {mediaUrl ? (
                <ImageWithFallback src={preview} alt={post.author_name ? `Post from ${post.author_name}` : 'Event post media'} fallback={fallbackImage} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted/40 to-muted/20 px-4 text-center text-xs text-muted-foreground">
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
  const { shareEvent, sharePost, copyLink, isSharing } = useShare();
  const { toggleLike } = useOptimisticReactions();
  const { requireAuth } = useAuthGuard();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventRow | null>(null);
  const { beautifiedSlug } = useEventSlug(event);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'posts' | 'tagged'>('details');
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);
  const [commentContext, setCommentContext] = useState<{ postId: string; eventId: string; eventTitle: string } | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [pausedVideos, setPausedVideos] = useState<Record<string, boolean>>({});
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      try {
        let { data, error } = await supabase
          .from('events')
          .select(`
              id, slug, title, description, category, start_at, end_at, venue, city, country, address, lat, lng, cover_image_url,
              owner_context_type, owner_context_id, created_by, visibility, link_token,
              organizations:organizations!events_owner_context_id_fkey (id, name, handle, logo_url),
              creator:user_profiles!events_created_by_fkey (user_id, display_name, photo_url)
            `)
          .eq('slug', identifier)
          .limit(1);

        if ((!data || !data.length) && /^[0-9a-f-]{36}$/i.test(identifier)) {
          const byId = await supabase
            .from('events')
            .select(`
                id, slug, title, description, category, start_at, end_at, venue, city, country, address, lat, lng, cover_image_url,
                owner_context_type, owner_context_id, created_by, visibility, link_token,
                organizations:organizations!events_owner_context_id_fkey (id, name, handle, logo_url),
                creator:user_profiles!events_created_by_fkey (user_id, display_name, photo_url)
              `)
            .eq('id', identifier)
            .limit(1);
          data = byId.data; error = byId.error;
        }
        if (!isMounted) return;
        if (error) { console.error('Event fetch error:', error); setEvent(null); setLoading(false); return; }
        const eventRow = data?.[0] ?? null; setEvent(eventRow as EventRow | null);
        if (eventRow) {
          const [{ data: atts }, { count }] = await Promise.all([
            supabase
              .from('tickets')
              .select('owner_user_id')
              .eq('event_id', eventRow.id)
              .in('status', ['issued', 'transferred', 'redeemed'])
              .limit(12),
            supabase
              .from('tickets')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', eventRow.id)
              .in('status', ['issued', 'transferred', 'redeemed']),
          ]);
          
          if (isMounted && atts && atts.length > 0) {
            // Fetch user profiles separately
            const userIds = atts.map((t: any) => t.owner_user_id);
            const { data: profiles } = await supabase
              .from('user_profiles')
              .select('user_id, display_name, photo_url')
              .in('user_id', userIds);
            
            const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
            setAttendees(atts.map((t: any) => {
              const profile = profilesMap.get(t.owner_user_id);
              return {
                id: profile?.user_id || t.owner_user_id,
                display_name: profile?.display_name || 'Unknown',
                photo_url: profile?.photo_url || null
              };
            }));
          } else if (isMounted) {
            setAttendees([]);
          }
          
          if (isMounted) {
            setAttendeeCount(count || 0);
          }
        }
      } catch (error) {
        console.error('Event fetch error:', error); if (isMounted) setEvent(null);
      } finally { if (isMounted) setLoading(false); }
    })();
    return () => { isMounted = false; };
  }, [identifier]);

  const eventId = event?.id ?? null;

  const taggedQuery = useInfiniteQuery<EventPostPage, Error>({
    queryKey: ['eventProfilePosts', eventId, 'tagged'],
    queryFn: ({ pageParam }) => fetchEventPostsPage(eventId!, 'tagged', pageParam as EventPostCursor | undefined),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(eventId),
    staleTime: 15_000,
  });

  const postsQuery = useInfiniteQuery<EventPostPage, Error>({
    queryKey: ['eventProfilePosts', eventId, 'posts'],
    queryFn: ({ pageParam }) => fetchEventPostsPage(eventId!, 'posts', pageParam as EventPostCursor | undefined),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(eventId),
    staleTime: 15_000,
  });

  const taggedPosts = useMemo(() => taggedQuery.data?.pages.flatMap((p) => p.items) ?? [], [taggedQuery.data]);
  const organizerPosts = useMemo(() => postsQuery.data?.pages.flatMap((p) => p.items) ?? [], [postsQuery.data]);

  const locationDisplay = useMemo(() => {
    if (!event) return 'Location TBA';
    const parts = [event.venue, event.city, event.country].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Location TBA';
  }, [event]);

  const locationLines = useMemo(() => {
    const lines = [event?.venue, event?.address, [event?.city, event?.country].filter(Boolean).join(', ')]
      .map((line) => (line ? line.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set(lines));
  }, [event?.venue, event?.address, event?.city, event?.country]);

  const headerWhen = useMemo(() => {
    if (!event?.start_at) return 'Date TBA';
    try {
      const start = new Date(event.start_at);
      const date = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(start);
      const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(start);
      if (event.end_at) {
        const end = new Date(event.end_at);
        const endTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(end);
        return `${date} • ${time} – ${endTime}`;
      }
      return `${date} • ${time}`;
    } catch { return 'Date TBA'; }
  }, [event?.start_at, event?.end_at]);

  const detailedDate = useMemo(() => {
    if (!event?.start_at) return 'Date TBA';
    try { return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(event.start_at)); } catch { return 'Date TBA'; }
  }, [event?.start_at]);

  const detailedTime = useMemo(() => {
    if (!event?.start_at) return 'Time TBA';
    try {
      const start = new Date(event.start_at);
      const startTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(start);
      if (event?.end_at) {
        const end = new Date(event.end_at);
        const endTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(end);
        return `${startTime} – ${endTime}`;
      }
      return startTime;
    } catch { return 'Time TBA'; }
  }, [event?.start_at, event?.end_at]);

  const timeZoneName = useMemo(() => {
    if (!event?.start_at) return null;
    try {
      const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date(event.start_at));
      const tzPart = parts.find((p) => p.type === 'timeZoneName');
      return tzPart?.value ?? null;
    } catch { return null; }
  }, [event?.start_at]);

  const eventInitials = useMemo(() => {
    if (!event?.title) return 'EV';
    return event.title.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }, [event?.title]);

  const descriptionHtml = useMemo(() => sanitizeHtml(event?.description || 'Details coming soon.'), [event?.description]);

  const taggedCount = useMemo(() => taggedQuery.data?.pages?.[0]?.totalCount ?? null, [taggedQuery.data]);
  const postsCount = useMemo(() => postsQuery.data?.pages?.[0]?.totalCount ?? null, [postsQuery.data]);

  const taggedHasMore = Boolean(taggedQuery.hasNextPage);
  const postsHasMore = Boolean(postsQuery.hasNextPage);

  const handleTaggedLoadMore = useCallback(() => { if (taggedQuery.hasNextPage && !taggedQuery.isFetchingNextPage) taggedQuery.fetchNextPage(); }, [taggedQuery]);
  const handlePostsLoadMore = useCallback(() => { if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) postsQuery.fetchNextPage(); }, [postsQuery]);

  const taggedLoadMoreRef = useInfiniteScroll(taggedHasMore, taggedQuery.isFetchingNextPage, handleTaggedLoadMore);
  const postsLoadMoreRef = useInfiniteScroll(postsHasMore, postsQuery.isFetchingNextPage, handlePostsLoadMore);

  const taggedFeedMap = useMemo(() => {
    if (!event) return new Map<string, FeedItem>();
    return new Map(taggedPosts.map((post) => [post.id, mapPostToFeedItem(post, event, locationDisplay)]));
  }, [taggedPosts, event, locationDisplay]);

  const organizerFeedMap = useMemo(() => {
    if (!event) return new Map<string, FeedItem>();
    return new Map(organizerPosts.map((post) => [post.id, mapPostToFeedItem(post, event, locationDisplay)]));
  }, [organizerPosts, event, locationDisplay]);

  useEffect(() => {
    if (!selectedPost) return;
    const updated = taggedFeedMap.get(selectedPost.item_id) ?? organizerFeedMap.get(selectedPost.item_id);
    if (updated) {
      setSelectedPost((prev) => {
        if (!prev) return updated;
        if (prev.metrics.likes === updated.metrics.likes && prev.metrics.viewer_has_liked === updated.metrics.viewer_has_liked && prev.metrics.comments === updated.metrics.comments) return prev;
        return { ...prev, metrics: { ...prev.metrics, ...updated.metrics } };
      });
    }
  }, [selectedPost?.item_id, taggedFeedMap, organizerFeedMap]);

  const handleSelectPost = useCallback((post: EventPostWithMeta) => {
    if (!event) return; 
    const feedItem = taggedFeedMap.get(post.id) ?? organizerFeedMap.get(post.id); 
    if (feedItem) {
      setSelectedPost(feedItem);
      // Auto-play video when modal opens - mark it as NOT paused (playing)
      setPausedVideos(prev => ({
        ...prev,
        [feedItem.item_id]: false, // false = video will play
      }));
    }
  }, [event, taggedFeedMap, organizerFeedMap]);

  const updateCachedPost = useCallback((postId: string, updater: (item: EventPostWithMeta) => EventPostWithMeta) => {
    if (!eventId) return;
    const applyUpdate = (filter: EventPostFilter) => {
      const key = ['eventProfilePosts', eventId, filter] as const;
      queryClient.setQueryData<InfiniteData<EventPostPage>>(key, (data) => {
        if (!data) return data;
        return { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map((item) => (item.id === postId ? updater(item) : item)) })) };
      });
    };
    applyUpdate('tagged'); applyUpdate('posts');
  }, [eventId, queryClient]);

  const { toggleLike: likeAction } = useOptimisticReactions();

  const handleLike = useCallback(async (postId: string) => {
    if (!selectedPost || selectedPost.item_id !== postId) return;
    const currentLiked = Boolean(selectedPost.metrics.viewer_has_liked);
    const currentLikes = Number(selectedPost.metrics.likes ?? 0);
    const result = await likeAction(postId, currentLiked, currentLikes);
    if (!result.ok) return;
    setSelectedPost((prev) => prev ? { ...prev, metrics: { ...prev.metrics, likes: result.likeCount, viewer_has_liked: result.isLiked } } : prev);
    updateCachedPost(postId, (item) => ({ ...item, like_count: result.likeCount, viewer_has_liked: result.isLiked }));
  }, [selectedPost, likeAction, updateCachedPost]);

  const { sharePost: sharePostAction } = useShare();
  const handleSharePost = useCallback((postId: string) => {
    if (!selectedPost || selectedPost.item_id !== postId) return;
    const eventTitle = selectedPost.event_title || event?.title || 'Event';
    const text = selectedPost.content || undefined;
    sharePostAction(postId, eventTitle, text);
  }, [selectedPost, sharePostAction, event?.title]);

  const handleComment = useCallback((postId: string) => {
    if (!selectedPost || selectedPost.item_id !== postId) return;
    requireAuth(() => {
      setCommentContext({
        postId: selectedPost.item_id,
        eventId: selectedPost.event_id,
        eventTitle: selectedPost.event_title,
      });
      setShowCommentModal(true);
    }, 'Please sign in to comment');
  }, [selectedPost, requireAuth]);

  const handleReport = useCallback(() => {
    toast({
      title: 'Report received',
      description: 'Thanks for flagging this. Our safety team will take a look.',
    });
  }, [toast]);

  const handleAuthorClick = useCallback((authorId: string) => { if (!authorId) return; setSelectedPost(null); navigate(`/u/${authorId}`); }, [navigate]);
  const handleModalEventClick = useCallback((eventIdToOpen: string) => { setSelectedPost(null); navigate(`/e/${event?.slug ?? eventIdToOpen}`); }, [navigate, event?.slug]);
  
  const handleVideoToggle = useCallback((postId?: string) => {
    if (!postId && selectedPost) {
      postId = selectedPost.item_id;
    }
    if (!postId) return;

    // Toggle pause state for the clicked video
    const isCurrentlyPaused = pausedVideos[postId] ?? true; // Videos start paused by default
    
    setPausedVideos((prev) => ({
      ...prev,
      [postId]: !isCurrentlyPaused,
    }));
    
    // If we're unpausing this video, pause all other videos
    if (isCurrentlyPaused) {
      setPausedVideos(prev => {
        const newState = { ...prev, [postId]: false };
        // Pause all other videos
        Object.keys(prev).forEach(videoId => {
          if (videoId !== postId) {
            newState[videoId] = true;
          }
        });
        return newState;
      });
    }
  }, [selectedPost, pausedVideos]);

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-gradient-to-b from-black via-[#0B0B10] to-[#0B0B10] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white/60" />
      </div>
    );
  }
  if (!event) return <div className="min-h-[60vh] flex items-center justify-center text-white/70">Event not found</div>;

  const linkTokenFromUrl = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('k');
  const robotsNoIndex = event?.visibility && !shouldIndexEvent(event.visibility);
  const shareUrl = buildEventShareUrl({ idOrSlug: event.slug ?? event.id, visibility: event.visibility as any, linkToken: event.visibility === 'unlisted' ? event.link_token ?? null : null });
  const meta = buildMeta(event, headerWhen, `${safeOrigin}${shareUrl}`);
  const shareLink = `${safeOrigin}${shareUrl}`;

  const numericLat = event.lat !== null && event.lat !== undefined ? Number(event.lat) : null;
  const numericLng = event.lng !== null && event.lng !== undefined ? Number(event.lng) : null;
  const hasCoordinates = numericLat !== null && !Number.isNaN(numericLat) && numericLng !== null && !Number.isNaN(numericLng);
  const hasLocationDetails = locationLines.length > 0;
  const fullAddress = [event.venue, event.city, event.country].filter(Boolean).join(', ');

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org', '@type': 'Event', name: event.title,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', startDate: event.start_at || undefined, endDate: event.end_at || undefined,
    image: event.cover_image_url ? [event.cover_image_url] : undefined, description: stripHtml(event.description),
    location: fullAddress ? { '@type': 'Place', name: event.venue || undefined, address: { '@type': 'PostalAddress', streetAddress: event.venue || undefined, addressLocality: event.city || undefined, addressCountry: event.country || undefined } } : undefined,
    organizer: event.organizations ? { '@type': 'Organization', name: event.organizations.name, url: `${safeOrigin}/org/${event.organizations.handle ?? event.organizations.id}` } : undefined,
    url: `${safeOrigin}${shareUrl}`,
  };

  const coverImage = event.cover_image_url || DEFAULT_EVENT_COVER;
  const hostName = event.organizations?.name ?? event.creator?.display_name ?? 'Host';
  const hostAvatar = event.organizations?.logo_url || event.creator?.photo_url || coverImage;
  const hostLink = event.organizations ? `/org/${event.organizations.handle ?? event.organizations.id}` : event.creator ? `/u/${event.creator.user_id}` : undefined;

  const handleCopyLink = () => { void copyLink(shareLink, 'Event link copied!'); };
  const handleOpenDirections = () => {
    if (typeof window === 'undefined') return;
    const fallbackLocation = fullAddress || event.venue || event.title;
    if (hasCoordinates && numericLat !== null && numericLng !== null) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${numericLat},${numericLng}`,'_blank','noopener'); return;
    }
    if (fallbackLocation) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackLocation)}`,'_blank','noopener');
  };

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

      <AccessGate eventId={event.id} visibility={event.visibility as any} linkTokenFromUrl={linkTokenFromUrl} onTokenAccepted={() => {}}>
        <div className="pb-20 text-white bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(56,189,248,0.12),transparent),radial-gradient(800px_400px_at_100%_0%,rgba(244,114,182,0.12),transparent)]">
          {/* HERO */}
          <div className="relative h-64 w-full overflow-hidden">
            <ImageWithFallback src={coverImage} alt={event.title} className="h-full w-full object-cover" fetchPriority="high" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B10] via-[#0B0B10]/70 to-transparent" />
          </div>

          {/* HEADER CARD */}
          <div className="mx-auto -mt-20 max-w-6xl px-4">
            <Card className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.6)]">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Avatar className="h-20 w-20 shrink-0 border-2 border-border/50 shadow-lg">
                      <AvatarImage src={hostAvatar} alt={hostName} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/70 to-accent/70 text-primary-foreground font-bold">{eventInitials}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      {event.category && (
                        <Badge variant="secondary" className="uppercase tracking-wide bg-card/50 text-foreground border-border/50">{event.category}</Badge>
                      )}
                      <h1 className="text-2xl md:text-3xl font-semibold leading-tight">{event.title}</h1>
                       {beautifiedSlug && (
                         <div className="mt-3">
                           <EventSlugDisplay slug={beautifiedSlug} />
                         </div>
                       )}
                      <div className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /><span>{headerWhen}</span></div>
                        <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><span>{locationDisplay}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button variant="outline" className="gap-2 border-border/50 text-muted-foreground hover:text-foreground" onClick={() => shareEvent(event.id, event.title)} disabled={isSharing}><Share2 className="h-4 w-4" />Share</Button>
                    <Button className="gap-2 rounded-full bg-amber-500 text-black shadow hover:bg-amber-600 font-bold" onClick={() => setShowTicketModal(true)}><Ticket className="h-4 w-4" />Get Tickets</Button>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-8">
                    <Stat label="Tagged" value={taggedCount ?? taggedPosts.length} />
                    <Stat label="Posts" value={postsCount ?? organizerPosts.length} />
                    <Stat label="Going" value={attendeeCount} />
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex -space-x-2">
                      {attendees.slice(0, 6).map((a) => (
                        <Avatar key={a.id} className="h-8 w-8 border-2 border-[#0B0B10]">
                          <AvatarImage src={a.photo_url ?? undefined} alt={a.display_name ?? 'Attendee'} />
                          <AvatarFallback>{a.display_name?.[0]?.toUpperCase() ?? 'Y'}</AvatarFallback>
                        </Avatar>
                      ))}
                      {attendees.length === 0 && <span className="text-xs text-muted-foreground">Be the first to attend</span>}
                    </div>
                    <Button variant="ghost" size="sm" className="self-start text-muted-foreground hover:text-foreground" onClick={() => navigate(`/e/${event.slug ?? event.id}/attendees`)}>
                      <Users className="mr-2 h-4 w-4" /> See attendees
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* BODY */}
          <div className="mx-auto mt-10 max-w-6xl px-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3 rounded-2xl border border-border/50 bg-card/50 p-1 backdrop-blur">
                <StyledTab value="details" label="Details" />
                <StyledTab value="posts" label={`Posts${typeof postsCount === 'number' ? ` (${postsCount})` : ''}`} />
                <StyledTab value="tagged" label={`Tagged${typeof taggedCount === 'number' ? ` (${taggedCount})` : ''}`} />
              </TabsList>

              <TabsContent value="details" className="mt-6">
                <div className="grid gap-6 xl:grid-cols-[1.75fr,1fr]">
                  <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur shadow-lg">
                    <CardContent className="space-y-8 p-6 md:p-8">
                      <SectionHeading eyebrow="Overview" title="About this experience" />
                      <div className="prose prose-sm md:prose-base prose-invert max-w-none text-muted-foreground">
                        <div dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <InfoCard color="orange" icon={<Calendar className="h-5 w-5" />} title="Schedule" subtitle={detailedDate} detail={<>{detailedTime}{timeZoneName ? <span className="ml-1 text-muted-foreground"> • {timeZoneName}</span> : null}</>} />
                        <InfoCard color="amber" icon={<MapPin className="h-5 w-5" />} title="Location" subtitle={hasLocationDetails ? undefined : 'Location details coming soon.'} detail={hasLocationDetails ? (
                          <div className="space-y-1">{locationLines.map((line) => (<p key={line} className="text-sm font-medium text-foreground">{line}</p>))}</div>
                        ) : undefined} action={(hasCoordinates || hasLocationDetails) ? (
                           <Button variant="ghost" size="sm" className="mt-2 h-9 w-full justify-start gap-2 rounded-xl border border-border/50 bg-card/50 text-muted-foreground hover:text-foreground" onClick={handleOpenDirections}>
                             <Navigation className="h-4 w-4" /> Open in Maps
                           </Button>
                        ) : null} />
                        <InfoCard color="yellow" className="md:col-span-2" icon={<Users className="h-5 w-5" />} title="Network" subtitle={attendeeCount > 0 ? `${attendeeCount} going` : 'Be the first to RSVP'} detail="See who's attending and start making connections early." action={<Button variant="outline" size="sm" className="mt-2 border-border/50 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/e/${event.slug ?? event.id}/attendees`)}>Meet the guest list</Button>} />
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {event.category && <Pill>{event.category}</Pill>}
                        <Pill>{event.owner_context_type === 'organization' ? 'Presented by a team' : 'Hosted by a creator'}</Pill>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    <Card className="overflow-hidden rounded-3xl border border-border/50 bg-card/50 backdrop-blur shadow-lg">
                      {hasCoordinates ? (
                        <>
                          <CardContent className="p-0"><MapboxEventMap lat={numericLat ?? 0} lng={numericLng ?? 0} venue={event.venue ?? undefined} address={event.address ?? undefined} city={event.city ?? undefined} country={event.country ?? undefined} className="h-64 w-full" /></CardContent>
                          <div className="border-t border-border/50 px-6 py-4 text-sm text-muted-foreground">
                            <p className="text-sm font-semibold text-foreground">Getting there</p>
                            <p className="mt-1">{hasLocationDetails ? locationLines.join(' • ') : 'Exact address provided upon RSVP.'}</p>
                          </div>
                        </>
                      ) : (
                        <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
                          <p className="text-sm font-semibold text-foreground">Getting there</p>
                          <p>{hasLocationDetails ? locationLines.join(' • ') : 'Exact map pin coming soon. We will update this section once the host finalizes the venue.'}</p>
                          {hasLocationDetails && <Button variant="outline" size="sm" className="w-full justify-center gap-2 border-border/50 text-muted-foreground hover:text-foreground" onClick={handleOpenDirections}><Navigation className="h-4 w-4" />Open in Maps</Button>}
                        </CardContent>
                      )}
                    </Card>

                    <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur shadow-lg">
                      <CardContent className="flex items-center gap-4 p-6">
                        <Avatar className="h-16 w-16 border-2 border-border/50 shadow-lg">
                          <AvatarImage src={hostAvatar} alt={hostName} />
                          <AvatarFallback className="bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-lg">{eventInitials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Hosted by</p>
                          {hostLink ? (
                            <Link to={hostLink} className="text-lg font-bold text-foreground hover:text-primary transition-colors">{hostName}</Link>
                          ) : (
                            <p className="text-lg font-bold text-foreground">{hostName}</p>
                          )}
                          <p className="text-sm text-muted-foreground">{event.owner_context_type === 'organization' ? 'Official YardPass organizer' : 'Independent host on YardPass'}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur shadow-lg">
                      <CardContent className="space-y-4 p-6">
                        <h3 className="text-lg font-bold text-foreground">Quick actions</h3>
                        <div className="space-y-3">
                          <Button className="w-full justify-center gap-2" onClick={() => setShowTicketModal(true)}><Ticket className="h-4 w-4" />Get tickets</Button>
                          <Button variant="outline" className="w-full justify-center gap-2 border-border/50 text-muted-foreground hover:text-foreground" onClick={() => shareEvent(event.id, event.title)} disabled={isSharing}><Share2 className="h-4 w-4" />Share with friends</Button>
                          <Button variant="ghost" className="w-full justify-center gap-2 text-muted-foreground hover:text-foreground" onClick={() => copyLink(`${safeOrigin}${shareUrl}`, 'Event link copied!')}><Copy className="h-4 w-4" />Copy link</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="posts" className="mt-6">
                <EventPostGrid posts={organizerPosts} isLoading={postsQuery.isLoading && !organizerPosts.length} loadingMore={postsQuery.isFetchingNextPage} onSelect={handleSelectPost} loadMoreRef={postsHasMore ? (postsLoadMoreRef as any) : undefined} fallbackImage={coverImage} emptyTitle="Host has no posts yet" emptyDescription="Organizers can post updates, teasers, and behind-the-scenes moments." />
              </TabsContent>

              <TabsContent value="tagged" className="mt-6">
                <EventPostGrid posts={taggedPosts} isLoading={taggedQuery.isLoading && !taggedPosts.length} loadingMore={taggedQuery.isFetchingNextPage} onSelect={handleSelectPost} loadMoreRef={taggedHasMore ? (taggedLoadMoreRef as any) : undefined} fallbackImage={coverImage} emptyTitle="No tagged posts yet" emptyDescription="When attendees share memories from this event, they'll appear here." />
              </TabsContent>
            </Tabs>
          </div>

          {/* POST MODAL */}
           <Dialog open={Boolean(selectedPost)} onOpenChange={(open) => { 
             if (!open) {
               setSelectedPost(null);
               // Reset all videos to paused when modal closes
               if (selectedPost) {
                 setPausedVideos(prev => ({
                   ...prev,
                   [selectedPost.item_id]: true,
                 }));
               }
             }
           }}>
            {selectedPost && selectedPost.item_type === 'post' ? (
              isMobile ? (
                <BottomSheetContent className="h-[90vh] overflow-hidden bg-black">
                  <UserPostCard 
                    item={selectedPost} 
                    onLike={(postId) => handleLike(postId)} 
                    onComment={(postId) => handleComment(postId)} 
                    onShare={(postId) => handleSharePost(postId)} 
                    onEventClick={(id) => { 
                      setSelectedPost(null); 
                      setPausedVideos(prev => ({ ...prev, [selectedPost.item_id]: true }));
                      navigate(`/e/${event.slug ?? id}`); 
                    }} 
                    onAuthorClick={(authorId) => { 
                      setSelectedPost(null); 
                      setPausedVideos(prev => ({ ...prev, [selectedPost.item_id]: true }));
                      navigate(`/u/${authorId}`); 
                    }} 
                    onCreatePost={() => {}} 
                    onReport={handleReport} 
                    onSoundToggle={() => setSoundEnabled(prev => !prev)} 
                    onVideoToggle={handleVideoToggle} 
                    onOpenTickets={() => setShowTicketModal(true)} 
                    soundEnabled={soundEnabled} 
                    isVideoPlaying={!pausedVideos[selectedPost.item_id]} 
                  />
                </BottomSheetContent>
              ) : (
                <DialogContent className="h-[90vh] w-full max-w-4xl overflow-hidden bg-black border-border/50 p-0">
                  <UserPostCard 
                    item={selectedPost} 
                    onLike={(postId) => handleLike(postId)} 
                    onComment={(postId) => handleComment(postId)} 
                    onShare={(postId) => handleSharePost(postId)} 
                    onEventClick={(id) => { 
                      setSelectedPost(null); 
                      setPausedVideos(prev => ({ ...prev, [selectedPost.item_id]: true }));
                      navigate(`/e/${event.slug ?? id}`); 
                    }} 
                    onAuthorClick={(authorId) => { 
                      setSelectedPost(null); 
                      setPausedVideos(prev => ({ ...prev, [selectedPost.item_id]: true }));
                      navigate(`/u/${authorId}`); 
                    }} 
                    onCreatePost={() => {}} 
                    onReport={handleReport} 
                    onSoundToggle={() => setSoundEnabled(prev => !prev)} 
                    onVideoToggle={handleVideoToggle} 
                    onOpenTickets={() => setShowTicketModal(true)} 
                    soundEnabled={soundEnabled} 
                    isVideoPlaying={!pausedVideos[selectedPost.item_id]} 
                  />
                </DialogContent>
              )
            ) : null}
          </Dialog>

          <EventTicketModal event={event ? { id: event.id, title: event.title, start_at: event.start_at || '', venue: event.venue || undefined, address: fullAddress, description: stripHtml(event.description) || undefined } : null} isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} onSuccess={() => setShowTicketModal(false)} />

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
                // Update the selected post's comment count
                if (selectedPost && selectedPost.item_id === commentContext.postId) {
                  setSelectedPost((prev) => prev ? { ...prev, metrics: { ...prev.metrics, comments: Number(count) } } : prev);
                }
                // Update the cached posts
                updateCachedPost(commentContext.postId, (item) => ({ ...item, comment_count: Number(count) }));
              }}
            />
          )}
        </div>
      </AccessGate>
    </>
  );
}

/* -------------------- Small Presentational Helpers -------------------- */
function Stat({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function StyledTab({ value, label }: { value: string; label: string }) {
  return (
    <TabsTrigger value={value} className="rounded-xl text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-card/50 hover:text-foreground transition-colors">
      {label}
    </TabsTrigger>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        <span className="h-px w-12 rounded-full bg-gradient-to-r from-primary/70 to-accent/70" />
        {eyebrow}
      </div>
      <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
    </div>
  );
}

function InfoCard({ color, icon, title, subtitle, detail, action, className }: { color: 'orange' | 'amber' | 'yellow'; icon: React.ReactNode; title: string; subtitle?: string; detail?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const bg = color === 'orange' ? 'from-orange-500/20 to-orange-600/20' : color === 'amber' ? 'from-amber-500/20 to-amber-600/20' : 'from-yellow-500/20 to-yellow-600/20';
  const pill = color === 'orange' ? 'bg-orange-500/30 text-orange-200' : color === 'amber' ? 'bg-amber-500/30 text-amber-200' : 'bg-yellow-500/30 text-yellow-200';
  return (
    <div className={`rounded-2xl border border-white/15 bg-gradient-to-br ${bg} p-4 backdrop-blur-sm shadow-inner ${className ?? ''}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pill} shadow-lg`}>{icon}</div>
        <div className="space-y-1 text-foreground/90">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
          {subtitle && <p className="text-sm font-bold text-foreground">{subtitle}</p>}
          {typeof detail === 'string' ? <p className="text-sm text-foreground/80">{detail}</p> : detail}
          {action}
        </div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <Badge className="rounded-full border border-border/50 bg-card/80 text-xs font-semibold uppercase tracking-wide text-foreground backdrop-blur-sm shadow-sm">
      {children}
    </Badge>
  );
}
