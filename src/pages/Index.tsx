// src/pages/Index.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateMetaTags, defaultMeta } from '@/utils/meta';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import {
  Heart,
  MessageCircle,
  Share,
  MoreVertical,
  Plus,
  Play,
  Image as ImageIcon,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { ShareModal } from '@/components/ShareModal';
import { PostCreatorModal } from '@/components/PostCreatorModal';
import CommentModal from '@/components/CommentModal';

import { useAuthGuard } from '@/hooks/useAuthGuard';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { useAffinityFeed } from '@/hooks/useAffinityFeed';
import { useRealtimePosts } from '@/hooks/useRealtimePosts';
import { OrganizerChip } from '@/components/OrganizerChip';
import { extractMuxPlaybackId } from '@/utils/mux';
import { EventCTA } from '@/components/EventCTA';
import { FollowButton } from '@/components/follow/FollowButton';
import { AddToCalendar } from '@/components/AddToCalendar';
import { ReportButton } from '@/components/ReportButton';
import { supabase } from '@/integrations/supabase/client';

// ---------- Types ----------
interface EventPost {
  id: string;
  authorName: string;
  authorBadge: 'ORGANIZER' | 'ATTENDEE';
  isOrganizer?: boolean;
  content: string;
  timestamp: string;
  likes: number;
  mediaType?: 'image' | 'video' | 'none';
  mediaUrl?: string;       // mux:playbackId or direct URL
  thumbnailUrl?: string;
  commentCount?: number;
  authorId?: string;       // used for profile deep-link
  ticketTierId?: string;   // used to deep-link ticket tab
  ticketBadge?: string;
}

interface TicketTier {
  id: string;
  name: string;
  price: number;
  badge: string;
  available: number;
  total: number;
}

interface Event {
  id: string;
  title: string;
  description: string;
  organizer: string;
  organizerId: string;
  category: string;
  startAtISO: string;
  endAtISO?: string;
  dateLabel: string;
  location: string;
  coverImage: string;
  ticketTiers: TicketTier[];
  attendeeCount: number;
  likes: number;
  shares: number;
  isLiked?: boolean;
  posts?: EventPost[];
  organizerVerified?: boolean;
  minPrice?: number | null;
  remaining?: number | null;
}

interface IndexProps {
  onEventSelect: (event: Event) => void;
  onCreatePost: () => void;
  onCategorySelect?: (category: string) => void;
  onOrganizerSelect?: (organizerId: string, organizerName: string) => void;
}

// ---------- PostHero ----------
function PostHero({
  post,
  event,
  onOpenTickets,
  isActive,
  onPostClick,
}: {
  post: EventPost | undefined;
  event: Event;
  onOpenTickets: () => void;
  isActive: boolean;
  onPostClick: (postId: string) => void;
}) {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGuard();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);

  const src = useMemo(() => {
    if (!post?.mediaUrl) return undefined;
    return post.mediaUrl.startsWith('mux:')
      ? `https://stream.mux.com/${post.mediaUrl.replace('mux:', '')}.m3u8`
      : post.mediaUrl;
  }, [post?.mediaUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !post || post.mediaType !== 'video' || !src) return;

    setReady(false);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    v.src = '';
    v.load();

    const isHls = src.endsWith('.m3u8');
    const canPlayNative = v.canPlayType('application/vnd.apple.mpegurl') !== '';

    const init = async () => {
      try {
        const Hls = (await import('hls.js')).default;
        if (isHls && !canPlayNative && Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(v);
          hls.on(Hls.Events.MANIFEST_PARSED, () => setReady(true));
          hls.on(Hls.Events.ERROR, () => setReady(true));
        } else {
          v.src = src;
          v.onloadedmetadata = () => setReady(true);
        }
      } catch {
        v.src = src;
        v.onloadedmetadata = () => setReady(true);
      }
    };

    init();
    v.muted = true;
    v.playsInline = true;

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      v.pause();
    };
  }, [post?.id, post?.mediaType, src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || post?.mediaType !== 'video') return;

    if (isActive && ready) {
      v.play().catch(() => {});
    } else {
      v.pause();
      v.currentTime = 0;
    }
  }, [isActive, ready, post?.mediaType]);

  const handleToggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    v.muted = next;
    if (!next) v.play().catch(() => {});
  };

  const goToAuthor = () => {
    if (post?.authorId) {
      navigate(routes.user(post.authorId));
    } else {
      navigate(`${routes.event(event.id)}?tab=posts`);
    }
  };

  const goToOrganizer = () => {
    if (event.organizerId) {
      navigate(routes.org(event.organizerId));
    } else {
      navigate(`${routes.event(event.id)}?tab=details`);
    }
  };

  if (!post) return null;

  // --- VIDEO SLIDE ---
  if (post.mediaType === 'video' && src) {
    return (
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          loop
          muted={muted}
          playsInline
          preload="metadata"
          controls={false}
          disablePictureInPicture
          controlsList="nodownload noplaybackrate nofullscreen"
          onClick={handleToggleMute}
        />

        {/* Footer overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent">
          <div className="p-4 text-white">
            <div className="pointer-events-auto">
              <div className="text-sm font-semibold">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToAuthor();
                  }}
                  className="hover:text-primary transition-colors cursor-pointer underline"
                  title="View profile"
                >
                  {post.authorName}
                </button>
                {post.isOrganizer && (
                  <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded align-middle">
                    ORGANIZER
                  </span>
                )}
              </div>
              {post.content && (
                <div className="text-sm opacity-90 line-clamp-2">{post.content}</div>
              )}
            </div>

            {/* Event CTA row - Enhanced */}
            <div className="pointer-events-auto mt-3">
              <EventCTA
                eventTitle={event.title}
                startAtISO={event.startAtISO}
                attendeeCount={event.attendeeCount}
                minPrice={event.minPrice}
                remaining={event.remaining}
                onDetails={() => navigate(routes.event(event.id))}
                onGetTickets={() => requireAuth(() => onOpenTickets(), 'Please sign in to purchase tickets')}
              />

              {/* Organizer info and follow button */}
              <div className="flex items-center justify-between mt-2">
                {event.organizerId && event.organizer && (
                  <OrganizerChip
                    organizerId={event.organizerId}
                    name={event.organizer}
                    verified={!!event.organizerVerified}
                  />
                )}
                {event.organizerId && (
                  <FollowButton targetType="organizer" targetId={event.organizerId} />
                )}
              </div>

              {/* Add to calendar */}
              <div className="mt-2">
                <AddToCalendar
                  title={event.title}
                  description={event.description}
                  location={event.location}
                  startISO={event.startAtISO}
                  endISO={event.endAtISO}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Unmute hint */}
        {muted && (
          <button
            onClick={handleToggleMute}
            className="absolute top-16 right-4 bg-black/60 text-white rounded-full px-3 py-1 text-xs"
          >
            Tap for sound
          </button>
        )}
      </div>
    );
  }

  // --- IMAGE SLIDE ---
  return (
    <div className="absolute inset-0">
      <ImageWithFallback
        src={post.mediaUrl || post.thumbnailUrl || DEFAULT_EVENT_COVER}
        alt=""
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />

      <div className="absolute inset-x-0 bottom-0 p-4 text-white pointer-events-auto">
        <div className="text-sm font-semibold">
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToAuthor();
            }}
            className="hover:text-primary transition-colors cursor-pointer underline"
            title="View profile"
          >
            {post.authorName}
          </button>
          {post.isOrganizer && (
            <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded align-middle">
              ORGANIZER
            </span>
          )}
        </div>
        {post.content && <div className="text-sm opacity-90 line-clamp-2">{post.content}</div>}

        {event.organizer && event.organizerId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToOrganizer();
            }}
            className="mt-2 text-[11px] text-gray-200 underline hover:text-white"
            title="View organizer"
          >
            by {event.organizer}
          </button>
        )}

        {/* Recent Posts Rail for image slides */}
        <RecentPostsRail
          posts={event.posts || []}
          eventId={event.id}
          onPostClick={onPostClick}
          onViewAllClick={() => navigate(`${routes.event(event.id)}?tab=posts`)}
        />
      </div>
    </div>
  );
}

// ---------- RecentPostsRail (kept, optional to render) ----------
function RecentPostsRail({
  posts,
  eventId,
  onPostClick,
  onViewAllClick,
}: {
  posts: EventPost[];
  eventId: string;
  onPostClick: (postId: string) => void;
  onViewAllClick: () => void;
}) {
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [isVisible, setIsVisible] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px', threshold: 0.1 }
    );
    if (railRef.current) observer.observe(railRef.current);
    return () => observer.disconnect();
  }, []);

  if (!posts || posts.length === 0) {
    return (
      <div ref={railRef} className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
        <p className="text-sm text-gray-300 text-center">Be the first to post about this event!</p>
      </div>
    );
  }

  if (!isVisible) {
    return (
      <div ref={railRef} className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
        <div className="flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="ml-2 text-sm text-gray-300">Loading posts...</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={railRef} className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Recent Posts</h4>
        <button onClick={onViewAllClick} className="text-xs text-primary hover:text-primary/80 font-medium">
          View All
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {posts.map((post) => (
          <div
            key={post.id}
            onClick={() => onPostClick(post.id)}
            className="flex-shrink-0 w-24 h-24 bg-white/10 rounded-lg border border-white/20 cursor-pointer hover:bg-white/15 transition-all duration-200 relative group"
          >
            {post.thumbnailUrl ? (
              <div className="relative w-full h-full">
                <ImageWithFallback
                  src={post.thumbnailUrl}
                  alt="Post thumbnail"
                  className="w-full h-full object-cover rounded-lg"
                  onLoad={() => setImageLoading((prev) => ({ ...prev, [post.id]: false }))}
                  onError={() => setImageLoading((prev) => ({ ...prev, [post.id]: false }))}
                />
                {imageLoading[post.id] !== false && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/5">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center rounded-lg bg-white/5">
                {post.mediaType === 'video' ? (
                  <Play className="w-6 h-6 text-white/60" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-white/60" />
                )}
              </div>
            )}

            {post.mediaType === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center">
                  <Play className="w-4 h-4 text-white ml-0.5" />
                </div>
              </div>
            )}

            <div className="absolute bottom-1 left-1 right-1">
              <div className="bg-black/70 rounded px-1 py-0.5">
                <p className="text-xs text-white truncate">{post.authorName}</p>
                <div className="flex items-center gap-1 text-xs text-gray-300">
                  <Heart className="w-3 h-3" />
                  <span>{post.likes}</span>
                  {post.commentCount && post.commentCount > 0 && (
                    <>
                      <MessageCircle className="w-3 h-3 ml-1" />
                      <span>{post.commentCount}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Page ----------
export default function Index({ onEventSelect, onCreatePost }: IndexProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | undefined>(undefined);
  const [commentMediaId, setCommentMediaId] = useState<string | undefined>(undefined);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortByActivity, setSortByActivity] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const { withAuth, requireAuth } = useAuthGuard();
  const navigate = useNavigate();

  // Feed via RPC - upgraded to affinity feed
  const { data: feed, loading: feedLoading, error, setData: setFeed } = useAffinityFeed(8);

  // Map feed to local Event shape
  useEffect(() => {
    const mappedEvents: Event[] = (feed || []).map((ev) => ({
      id: ev.id,
      title: ev.title,
      description: ev.description || '',
      organizer: ev.organizerName || 'Unknown',
      organizerId: ev.organizerId || '',
      category: 'General',
      startAtISO: ev.startAtISO || new Date().toISOString(),
      endAtISO: undefined,
      dateLabel: ev.startAtISO ? new Date(ev.startAtISO).toLocaleDateString() : 'TBD',
      location: ev.location || '',
      coverImage: ev.coverImage || DEFAULT_EVENT_COVER,
      ticketTiers: [],
      attendeeCount: ev.attendeeCount || 0,
      likes: 0,
      shares: 0,
      isLiked: false,
      posts: [],
      organizerVerified: ev.organizerVerified,
      minPrice: ev.minPrice,
      remaining: ev.remaining,
    }));

    setEvents(mappedEvents);
    setLoading(feedLoading);
    if (error) {
      console.error('Home feed error:', error);
      toast({
        title: 'Failed to load events',
        description: 'Please try refreshing the page.',
        variant: 'destructive',
      });
    }
  }, [feed, feedLoading, error]);

  // ✅ Initial posts loader — fetch top posts for all currently loaded events
  useEffect(() => {
    (async () => {
      if (!events.length) return;

      // Only fetch for events that don't have posts yet
      const ids = events.filter((e) => !e.posts || e.posts.length === 0).map((e) => e.id);
      if (!ids.length) return;

      // Use the new RPC function for efficient post fetching
      const { data, error } = await supabase.rpc('get_event_posts', {
        p_event_ids: ids,
        p_k: 3
      });

      if (error) {
        console.error('Initial posts fetch failed:', error);
        return;
      }

      const grouped = new Map<string, EventPost[]>();
      for (const p of (data || [])) {
        const url: string | undefined = Array.isArray(p.media_urls) ? p.media_urls[0] : undefined;
        const isVideo = url ? /mux|\.mp4$|\.mov$|\.m3u8$/i.test(url) : false;

        const mapped: EventPost = {
          id: p.id,
          authorName: p.author_display_name || 'Someone',
          authorBadge: p.author_is_organizer ? 'ORGANIZER' : 'ATTENDEE',
          isOrganizer: !!p.author_is_organizer,
          authorId: p.author_user_id || undefined,
          content: p.text || '',
          timestamp: new Date(p.created_at).toLocaleDateString(),
          likes: p.like_count || 0,
          mediaType: isVideo ? 'video' : url ? 'image' : 'none',
          mediaUrl: url,
          thumbnailUrl: !isVideo ? url : undefined,
          commentCount: p.comment_count || 0,
          ticketTierId: p.ticket_tier_id || undefined,
        };

        const arr = grouped.get(p.event_id) ?? [];
        arr.push(mapped); // RPC already returns top 3 per event
        grouped.set(p.event_id, arr);
      }

      setEvents((prev) =>
        prev.map((ev) => (grouped.has(ev.id) ? { ...ev, posts: grouped.get(ev.id) } : ev))
      );
    })();
  }, [events.map((e) => e.id).join('|')]); // run when the set of event IDs changes

  // Realtime posts — prepend newest into event.posts
  useRealtimePosts(
    events.map((e) => e.id),
    (p) => {
      setFeed((prev) => {
        const next = (prev || []).map((ev: any) => {
          if (ev.id !== p.event_id) return ev;

          const url = (p.media_urls && p.media_urls[0]) || undefined;
          const isVideo = url ? /mux|\.mp4$|\.mov$|\.m3u8$/i.test(url) : false;

          const newPost: EventPost = {
            id: p.id,
            authorName: p.author_display_name || 'Someone',
            authorBadge: p.author_is_organizer ? 'ORGANIZER' : 'ATTENDEE',
            isOrganizer: !!p.author_is_organizer,
            authorId: p.author_id || p.author_user_id,
            content: p.text || '',
            timestamp: new Date(p.created_at).toLocaleDateString(),
            likes: p.like_count || 0,
            mediaType: isVideo ? 'video' : url ? 'image' : 'none',
            mediaUrl: url,
            thumbnailUrl: !isVideo ? url : undefined,
            commentCount: p.comment_count || 0,
            ticketTierId: p.ticket_tier_id || undefined,
          };

          const posts = [newPost, ...(ev.posts || [])].slice(0, 3);
          return { ...ev, posts };
        });
        return next;
      });

      // Also reflect into local `events` so the UI updates immediately
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id !== p.event_id) return ev;
          const url = (p.media_urls && p.media_urls[0]) || undefined;
          const isVideo = url ? /mux|\.mp4$|\.mov$|\.m3u8$/i.test(url) : false;
          const newPost: EventPost = {
            id: p.id,
            authorName: p.author_display_name || 'Someone',
            authorBadge: p.author_is_organizer ? 'ORGANIZER' : 'ATTENDEE',
            isOrganizer: !!p.author_is_organizer,
            authorId: p.author_id || p.author_user_id,
            content: p.text || '',
            timestamp: new Date(p.created_at).toLocaleDateString(),
            likes: p.like_count || 0,
            mediaType: isVideo ? 'video' : url ? 'image' : 'none',
            mediaUrl: url,
            thumbnailUrl: !isVideo ? url : undefined,
            commentCount: p.comment_count || 0,
            ticketTierId: p.ticket_tier_id || undefined,
          };
          const posts = [newPost, ...(ev.posts || [])].slice(0, 3);
          return { ...ev, posts };
        })
      );
    }
  );

  // Sort toggle: ranked (default) vs activity (light heuristic)
  useEffect(() => {
    if (!sortByActivity) return; // default order is from RPC
    setEvents((prev) => {
      const score = (ev: Event) => {
        const postAgg = (ev.posts || []).reduce(
          (s, p) => s + (p.likes || 0) + (p.commentCount || 0),
          0
        );
        const att = ev.attendeeCount || 0;
        return postAgg * 2 + att; // simple heuristic
      };
      const copy = [...prev];
      copy.sort((a, b) => score(b) - score(a));
      return copy;
    });
  }, [sortByActivity]);

  // Meta
  useEffect(() => {
    updateMetaTags(defaultMeta);
  }, []);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'PageUp') setCurrentIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowDown' || e.key === 'PageDown') setCurrentIndex((i) => Math.min(events.length - 1, i + 1));
      if (e.key === 'Home') setCurrentIndex(0);
      if (e.key === 'End') setCurrentIndex(Math.max(0, events.length - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [events.length]);

  // Preload neighbor covers (keeps scrolling snappy)
  useEffect(() => {
    const next = events[currentIndex + 1]?.coverImage;
    const prev = events[currentIndex - 1]?.coverImage;
    [next, prev]
      .filter(Boolean)
      .forEach((src) => {
        const img = new Image();
        img.src = src as string;
      });
  }, [currentIndex, events]);

  // Actions
  const handleLike = useCallback(
    withAuth((eventId: string) => {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId ? { ...ev, isLiked: !ev.isLiked, likes: ev.isLiked ? ev.likes - 1 : ev.likes + 1 } : ev
        )
      );
    }, 'Please sign in to like events'),
    [withAuth]
  );

  const goTo = useCallback((i: number) => setCurrentIndex(Math.max(0, Math.min(events.length - 1, i))), [events.length]);
  const currentEvent = events[Math.max(0, Math.min(currentIndex, events.length - 1))];

  const openCommentsForPost = useCallback(
    withAuth((pid?: string, post?: any) => {
      // Prefer the post's UUID
      setCommentPostId(pid);
      // Also pass playbackId so the modal can resolve if needed
      const playbackId = extractMuxPlaybackId(post?.mediaUrl);
      setCommentMediaId(playbackId ?? undefined);
      setShowCommentModal(true);
    }, 'Please sign in to comment on events'),
    [withAuth]
  );

  const handleComment = useCallback(() => {
    if (!currentEvent) return;
    const heroPost = (currentEvent.posts || []).find(p => !!p.mediaUrl) || (currentEvent.posts || [])[0];
    openCommentsForPost(heroPost?.id, heroPost);
  }, [currentEvent, openCommentsForPost]);

  const handleMore = useCallback(
    withAuth(() => toast({ title: 'More Options', description: 'Additional options coming soon…' }), 'Please sign in to access more options'),
    [withAuth]
  );

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
            <img src="/lovable-uploads/247f3ae4-8789-4a73-af97-f0e41767873a.png" alt="YardPass" className="w-10 h-10" />
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      </div>
    );
  }

  if (!currentEvent) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">No Events Found</h1>
        <p className="text-muted-foreground mb-4">There are currently no events to display.</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  const commentCount =
    ((currentEvent as any)?.totalComments) ??
    (currentEvent?.posts?.reduce((s, p) => s + (p.commentCount ?? 0), 0) ?? 0);

  return (
    <div className="h-screen relative overflow-hidden bg-black" style={{ touchAction: 'pan-y' }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/60 to-transparent p-4 pointer-events-auto">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/247f3ae4-8789-4a73-af97-f0e41767873a.png" alt="YardPass" className="w-8 h-8" />
            <span className="font-bold text-lg">YardPass</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortByActivity(!sortByActivity)}
              className="flex items-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition-all duration-200 backdrop-blur-sm"
              title={sortByActivity ? 'Sort by event date' : 'Sort by activity'}
            >
              {sortByActivity ? (
                <>
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-medium">Active</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium">Upcoming</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Slides */}
      <div
        ref={trackRef}
        className="h-full w-full relative transition-transform duration-300 ease-out"
        style={{ transform: `translateY(-${currentIndex * 100}%)` }}
      >
        {events.map((ev, i) => {
          const heroPost = (ev.posts || []).find((p) => !!p.mediaUrl) || (ev.posts || [])[0];
          return (
            <div key={ev.id} className="h-full w-full absolute" style={{ top: `${i * 100}%` }}>
              {heroPost ? (
                <PostHero
                  post={heroPost}
                  event={ev}
                  onOpenTickets={() => requireAuth(() => setShowTicketModal(true), 'Please sign in to purchase tickets')}
                  isActive={i === Math.max(0, Math.min(currentIndex, events.length - 1))}
                  onPostClick={openCommentsForPost}
                />
              ) : (
                <>
                  <ImageWithFallback src={ev.coverImage} alt={ev.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />

                  {/* Fallback overlay */}
                  <div className="absolute bottom-24 left-4 right-4 text-white z-30 pointer-events-auto">
                    <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4">
                      <h2 className="text-xl font-bold mb-1">{ev.title}</h2>
                      {ev.organizer && (
                        <button
                          onClick={() =>
                            ev.organizerId ? navigate(routes.org(ev.organizerId)) : navigate(`${routes.event(ev.id)}?tab=details`)
                          }
                          className="text-[11px] text-gray-200 underline hover:text-white mb-2"
                          title="View organizer"
                        >
                          by {ev.organizer}
                        </button>
                      )}
                      <p className="text-sm text-gray-300 mb-3">{ev.description}</p>

                      {/* Enhanced CTA for fallback card */}
                      <EventCTA
                        eventTitle={ev.title}
                        startAtISO={ev.startAtISO}
                        attendeeCount={ev.attendeeCount}
                        minPrice={ev.minPrice}
                        remaining={ev.remaining}
                        onDetails={() => navigate(routes.event(ev.id))}
                        onGetTickets={() => requireAuth(() => setShowTicketModal(true), 'Please sign in to purchase tickets')}
                      />

                      {/* Organizer info and follow for fallback */}
                      <div className="flex items-center justify-between mt-2">
                        {ev.organizerId && ev.organizer && (
                          <OrganizerChip
                            organizerId={ev.organizerId}
                            name={ev.organizer}
                            verified={!!ev.organizerVerified}
                          />
                        )}
                        {ev.organizerId && (
                          <FollowButton targetType="organizer" targetId={ev.organizerId} />
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Action rail */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 pointer-events-auto">
        <div className="flex flex-col items-center gap-4 text-white select-none">
          <IconButton ariaLabel="Like" active={currentEvent?.isLiked} count={currentEvent?.likes} onClick={() => currentEvent && handleLike(currentEvent.id)}>
            <Heart className={`w-6 h-6 ${currentEvent?.isLiked ? 'fill-white text-white' : 'text-white'}`} />
          </IconButton>
          <IconButton ariaLabel="Comments" count={commentCount} onClick={() => handleComment()}>
            <MessageCircle className="w-6 h-6 text-white" />
          </IconButton>
          <IconButton ariaLabel="Create post" onClick={() => requireAuth(() => onCreatePost(), 'Please sign in to create posts')}>
            <div className="p-3 rounded-full bg-primary/80 backdrop-blur-sm border border-primary/50 hover:bg-primary transition-all duration-200 shadow-lg">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-white drop-shadow-lg">Post</span>
          </IconButton>
          <IconButton ariaLabel="Share" onClick={() => setShowShareModal(true)}>
            <Share className="w-6 h-6 text-white" />
          </IconButton>
          <div className="pointer-events-auto">
            <ReportButton targetType="event" targetId={currentEvent?.id || ''} />
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-20">
        {events.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to event ${i + 1}`}
            onClick={() => goTo(i)}
            className={`w-1.5 h-8 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`}
          />
        ))}
      </div>

      {/* Swipe zone */}
      <div
        className="absolute z-10"
        style={{
          pointerEvents: 'auto',
          touchAction: 'pan-y',
          top: '12%',
          bottom: '32%',
          left: 0,
          right: '20%',
        }}
        onTouchStart={(e) => {
          (e.currentTarget as any).__startY = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          const startY = (e.currentTarget as any).__startY as number | undefined;
          if (startY == null) return;
          const diff = startY - e.changedTouches[0].clientY;
          if (Math.abs(diff) > 50)
            setCurrentIndex((i) => (diff > 0 ? Math.min(events.length - 1, i + 1) : Math.max(0, i - 1)));
          (e.currentTarget as any).__startY = undefined;
        }}
      />

      {/* Modals */}
      <AttendeeListModal
        isOpen={showAttendeeModal}
        onClose={() => setShowAttendeeModal(false)}
        eventTitle={currentEvent?.title || ''}
        attendeeCount={currentEvent?.attendeeCount || 0}
        attendees={[]}
      />

      <EventTicketModal
        event={{
          id: currentEvent?.id || '',
          title: currentEvent?.title || '',
          start_at: currentEvent?.startAtISO || '',
          venue: currentEvent?.location || '',
          address: currentEvent?.location || '',
          description: currentEvent?.description || '',
        }}
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onSuccess={() => {
          setShowTicketModal(false);
          toast({ title: 'Redirecting to Checkout', description: 'Opening Stripe checkout in a new tab…' });
        }}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        payload={
          showShareModal && currentEvent
            ? {
                title: currentEvent.title,
                text: `Check out ${currentEvent.title} - ${currentEvent.description}`,
                url: typeof window !== 'undefined' ? window.location.href : '',
              }
            : null
        }
      />

      <PostCreatorModal
        isOpen={postCreatorOpen}
        onClose={() => setPostCreatorOpen(false)}
        onSuccess={() => {
          setPostCreatorOpen(false);
          toast({ title: 'Success', description: 'Your post has been created!' });
        }}
        preselectedEventId={currentEvent?.id}
      />

      <CommentModal
        isOpen={showCommentModal}
        onClose={() => { 
          setShowCommentModal(false); 
          setCommentPostId(undefined);
          setCommentMediaId(undefined);
        }}
        eventId={currentEvent?.id || ''}
        eventTitle={currentEvent?.title || ''}
        postId={commentPostId}
        mediaPlaybackId={commentMediaId}
      />
    </div>
  );
}

function IconButton({
  children,
  onClick,
  count,
  active,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  count?: number;
  active?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="flex flex-col items-center gap-1 transition-transform active:scale-95 min-h-[56px] min-w-[56px] p-2 touch-manipulation"
      style={{ backgroundColor: 'transparent' }}
    >
      <div
        className={`p-3 rounded-full transition-all duration-200 ${
          active ? 'bg-red-500 shadow-lg shadow-red-500/30 scale-110' : 'bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-white/20'
        }`}
      >
        {children}
      </div>
      {typeof count !== 'undefined' && <span className="text-xs font-medium text-white drop-shadow-lg">{count}</span>}
    </button>
  );
}