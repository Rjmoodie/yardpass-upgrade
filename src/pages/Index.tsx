// src/pages/Index.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateMetaTags, defaultMeta } from '@/utils/meta';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import { Heart, MessageCircle, Share, MoreVertical, Plus, Play, Image as ImageIcon, TrendingUp, Clock, Crown } from 'lucide-react';
import { ShareModal } from '@/components/ShareModal';
import { PostCreatorModal } from '@/components/PostCreatorModal';
import { CommentModal } from '@/components/CommentModal';
import { PaymentSuccessHelper } from '@/components/PaymentSuccessHelper';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';
import { useShare } from '@/hooks/useShare';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { useHomeFeed } from '@/hooks/useHomeFeed';
import { useRealtimePosts } from '@/hooks/useRealtimePosts';
import { VerificationBadge } from '@/components/VerificationBadge';

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
  mediaUrl?: string;
  thumbnailUrl?: string;
  commentCount?: number;
  authorId?: string;       // for profile link (optional)
  ticketTierId?: string;   // for ticket tab deeplink (optional)
  ticketBadge?: string;    // badge label shown next to author (optional)
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
  isActive
}: {
  post: EventPost | undefined;
  event: Event;
  onOpenTickets: () => void;
  isActive: boolean;
}) {
  const navigate = useNavigate();
  const { requireAuth } = useAuthGuard();
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);

  // Build a playable src (Mux playback id or direct URL)
  const src = post?.mediaUrl
    ? post.mediaUrl.startsWith('mux:')
      ? `https://stream.mux.com/${post.mediaUrl.replace('mux:', '')}.m3u8`
      : post.mediaUrl
    : undefined;

  // Init HLS / attach media
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !post || post.mediaType !== 'video' || !src) return;

    // Reset previous
    setReady(false);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    v.src = ''; // detach old
    v.load();

    const isHls = src.endsWith('.m3u8');
    const canPlayNative = v.canPlayType('application/vnd.apple.mpegurl') !== '';

    // Dynamic import HLS.js
    const initHls = async () => {
      try {
        const Hls = (await import('hls.js')).default;
        if (isHls && !canPlayNative && Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(v);
          hls.on(Hls.Events.MANIFEST_PARSED, () => setReady(true));
          hls.on(Hls.Events.ERROR, () => setReady(true)); // still try to play
        } else {
          v.src = src;
          // When metadata is ready, mark ready
          v.onloadedmetadata = () => setReady(true);
        }
      } catch (error) {
        console.error('Failed to load HLS.js:', error);
        v.src = src;
        v.onloadedmetadata = () => setReady(true);
      }
    };

    initHls();

    // iOS autoplay requires muted + playsInline
    v.muted = true;
    v.playsInline = true;

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      v.pause();
    };
  }, [post?.id, src, post?.mediaType]);

  // Play only when this slide is active
  useEffect(() => {
    const v = videoRef.current;
    if (!v || post?.mediaType !== 'video') return;

    if (isActive && ready) {
      // Try autoplay (muted inline)
      v.play().catch(() => {/* user gesture required; keep overlay */});
    } else {
      v.pause();
      v.currentTime = 0; // rewind for that snappy TikTok feel
    }
  }, [isActive, ready, post?.mediaType]);

  // Tap anywhere toggles mute (unmute needs user gesture)
  const handleToggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    v.muted = next;
    if (!next) {
      v.play().catch(() => {/* ignore */});
    }
  };

  if (!post) return null;

  const anyRoutes = routes as any;

  const goToAuthor = () => {
    console.log('🔗 Clicking on author:', { 
      authorName: post.authorName, 
      authorId: post.authorId,
      route: post.authorId ? routes.user(post.authorId) : 'NO_ID'
    });
    
    if (post.authorId) {
      // Use the user ID directly with the user route
      navigate(routes.user(post.authorId));
    } else {
      console.warn('⚠️ No authorId found for post, using fallback');
      // Fallback: go to event posts tab
      navigate(`${routes.eventDetails(event.id)}?tab=posts`);
    }
  };

  const goToOrganizer = () => {
    if (typeof anyRoutes.org === 'function') {
      navigate(anyRoutes.org(event.organizerId));
    } else {
      navigate(`${routes.eventDetails(event.id)}?tab=details`);
    }
  };

  const goToTicketsTab = () => {
    const tierParam = post.ticketTierId ? `&tier=${post.ticketTierId}` : '';
    navigate(`${routes.eventDetails(event.id)}?tab=tickets${tierParam}`);
  };

  if (!post) return null;

  // VIDEO
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
          onClick={handleToggleMute} // TikTok-like: tap video to unmute/mute
        />

        {/* Unmute hint */}
        {muted && (
          <button
            onClick={handleToggleMute}
            className="absolute top-16 right-4 bg-black/60 text-white rounded-full px-3 py-1 text-xs"
          >
            Tap for sound
          </button>
        )}

        {/* Gradient + captions + actions footer */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent">
          <div className="p-4 text-white">
        <div className="text-sm font-semibold">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              goToAuthor();
            }}
            className="hover:text-primary transition-colors cursor-pointer underline"
          >
            {post.authorName}
          </button>{' '}
          {post.isOrganizer && (
            <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
              ORGANIZER
            </span>
          )}
        </div>
            {post.content && (
              <div className="text-sm opacity-90 line-clamp-2">{post.content}</div>
            )}

            {/* Event CTA row — keep clickable */}
            <div className="pointer-events-auto mt-3 flex items-center justify-between bg-black/40 backdrop-blur-sm rounded-lg p-3">
              <div className="min-w-0">
                <button
                  className="text-left"
                  onClick={() => navigate(routes.eventDetails(event.id))}
                  title="Open event"
                >
                  <h3 className="font-semibold text-sm truncate">{event.title}</h3>
                  <p className="text-xs text-gray-300 truncate">
                    {event.dateLabel} • {event.location}
                  </p>
                </button>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="glass"
                  onClick={() => navigate(routes.eventDetails(event.id))}
                  className="bg-white/20 text-white border-white/30 hover:bg-white/30 text-xs"
                >
                  Details
                </Button>
                <Button
                  size="sm"
                  variant="premium"
                  onClick={() =>
                    requireAuth(() => onOpenTickets(), 'Please sign in to purchase tickets')
                  }
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                >
                  Get Tickets
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // IMAGE fallback
  return (
    <div className="absolute inset-0">
      <ImageWithFallback
        src={post.mediaUrl || post.thumbnailUrl || DEFAULT_EVENT_COVER}
        alt=""
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />

      {/* Minimal footer for images */}
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <div className="text-sm font-semibold">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              goToAuthor();
            }}
            className="hover:text-primary transition-colors cursor-pointer underline"
          >
            {post.authorName}
          </button>{' '}
          {post.isOrganizer && (
            <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
              ORGANIZER
            </span>
          )}
        </div>
        {post.content && <div className="text-sm opacity-90 line-clamp-2">{post.content}</div>}
      </div>
    </div>
  );
}

// ---------- Mock fallback (kept minimal) ----------
const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Sample Event',
    description: 'Demo event when feed is empty.',
    organizer: 'Demo Org',
    organizerId: '101',
    category: 'Other',
    startAtISO: '2026-07-04T18:00:00Z',
    endAtISO: '2026-07-05T03:00:00Z',
    dateLabel: 'July 4, 2026',
    location: 'New York',
    coverImage: DEFAULT_EVENT_COVER,
    ticketTiers: [{ id: 't1', name: 'GA', price: 30, badge: 'GA', available: 100, total: 100 }],
    attendeeCount: 647,
    likes: 266,
    shares: 78,
    isLiked: false,
    posts: [],
  },
];

// ---------- RecentPostsRail ----------
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
                {post.mediaType === 'video' ? <Play className="w-6 h-6 text-white/60" /> : <ImageIcon className="w-6 h-6 text-white/60" />}
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
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortByActivity, setSortByActivity] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const { withAuth, requireAuth } = useAuthGuard();
  const navigate = useNavigate();
  const { shareEvent } = useShare();

  // Feed via RPC
  const { data: feed, loading: feedLoading, error, setData: setFeed } = useHomeFeed(3);

  useEffect(() => {
    setEvents(feed || []);
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

  // Realtime posts
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
            authorName: 'Someone',
            authorBadge: 'ATTENDEE',
            isOrganizer: false,
            content: p.text || '',
            timestamp: new Date(p.created_at).toLocaleDateString(),
            likes: p.like_count || 0,
            mediaType: isVideo ? 'video' : url ? 'image' : 'none',
            mediaUrl: url,
            thumbnailUrl: !isVideo ? url : undefined,
            commentCount: p.comment_count || 0,
          };
          const posts = [newPost, ...(ev.posts || [])].slice(0, 3);
          return { ...ev, posts };
        });
        return next;
      });
    }
  );

  // Clamp index
  const safeIndex = Math.max(0, Math.min(currentIndex, events.length - 1));
  const currentEvent = events[safeIndex];

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

  // Touch swipe helpers
  const startY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const diff = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) setCurrentIndex((i) => (diff > 0 ? Math.min(events.length - 1, i + 1) : Math.max(0, i - 1)));
    startY.current = null;
  };

  // Preload neighbors
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
        prev.map((ev) => (ev.id === eventId ? { ...ev, isLiked: !ev.isLiked, likes: ev.isLiked ? ev.likes - 1 : ev.likes + 1 } : ev))
      );
    }, 'Please sign in to like events'),
    []
  );

  const handleShare = useCallback((ev: Event) => {
    capture('share_click', { event_id: ev.id });
    setShowShareModal(true);
  }, []);

  const handleComment = useCallback(withAuth(() => setShowCommentModal(true), 'Please sign in to comment on events'), []);
  const handleMore = useCallback(
    withAuth(() => toast({ title: 'More Options', description: 'Additional options coming soon…' }), 'Please sign in to access more options'),
    []
  );

  const goTo = useCallback((i: number) => setCurrentIndex(Math.max(0, Math.min(events.length - 1, i))), [events.length]);

  const handlePostClick = useCallback(
    (postId: string) => {
      if (currentEvent?.id) navigate(`${routes.eventDetails(currentEvent.id)}?tab=posts&post=${postId}`);
    },
    [navigate, currentEvent?.id]
  );

  const handleViewAllPosts = useCallback(() => {
    if (currentEvent?.id) navigate(`${routes.eventDetails(currentEvent.id)}?tab=posts`);
  }, [navigate, currentEvent?.id]);

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
        <PaymentSuccessHelper />
        <Button onClick={() => window.location.href = window.location.href} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  // Safe comment count (no ?? / || mix)
  const commentCount =
    ((currentEvent as any)?.totalComments) ??
    (currentEvent.posts?.reduce((s, p) => s + (p.commentCount ?? 0), 0) ?? 0);

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
            <Button
              size="sm"
              variant="glass"
              onClick={() => requireAuth(() => onCreatePost(), 'Please sign in to create content')}
              className="bg-white/20 text-white border-white/30 hover:bg-white/30 min-h-[40px] px-3 font-semibold backdrop-blur-md shadow-lg"
            >
              + Create Post
            </Button>
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
                  isActive={i === safeIndex}
                />
              ) : (
                <>
                  <ImageWithFallback src={ev.coverImage} alt={ev.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
                  {/* Fallback event overlay (clickable) */}
                  <div className="absolute bottom-24 left-4 right-4 text-white z-30 pointer-events-auto">
                    <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4">
                      <h2 className="text-xl font-bold mb-2">{ev.title}</h2>
                      <p className="text-sm text-gray-300 mb-3">{ev.description}</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="glass"
                          onClick={() => navigate(routes.eventDetails(ev.id))}
                          className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                        >
                          Details
                        </Button>
                        <Button
                          size="sm"
                          variant="premium"
                          onClick={() => requireAuth(() => setShowTicketModal(true), 'Please sign in to purchase tickets')}
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          Get Tickets
                        </Button>
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
          <IconButton ariaLabel="Like" active={currentEvent.isLiked} count={currentEvent.likes} onClick={() => handleLike(currentEvent.id)}>
            <Heart className={`w-6 h-6 ${currentEvent.isLiked ? 'fill-white text-white' : 'text-white'}`} />
          </IconButton>
          <IconButton ariaLabel="Comments" count={commentCount} onClick={() => handleComment()}>
            <MessageCircle className="w-6 h-6 text-white" />
          </IconButton>
          <IconButton ariaLabel="Create post" onClick={() => requireAuth(() => setPostCreatorOpen(true), 'Please sign in to create posts')}>
            <div className="p-3 rounded-full bg-primary/80 backdrop-blur-sm border border-primary/50 hover:bg-primary transition-all duration-200 shadow-lg">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs font-medium text-white drop-shadow-lg">Post</span>
          </IconButton>
          <IconButton ariaLabel="Share" count={currentEvent.shares} onClick={() => setShowShareModal(true)}>
            <Share className="w-6 h-6 text-white" />
          </IconButton>
          <IconButton ariaLabel="More" onClick={() => handleMore()}>
            <MoreVertical className="w-6 h-6 text-white" />
          </IconButton>
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

      {/* Swipe zone (no clip-path; leaves header + bottom overlay clickable) */}
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
          if (Math.abs(diff) > 50) setCurrentIndex((i) => (diff > 0 ? Math.min(events.length - 1, i + 1) : Math.max(0, i - 1)));
          (e.currentTarget as any).__startY = undefined;
        }}
      />

      {/* Modals */}
      <AttendeeListModal
        isOpen={showAttendeeModal}
        onClose={() => setShowAttendeeModal(false)}
        eventTitle={currentEvent.title}
        attendeeCount={currentEvent.attendeeCount}
        attendees={[]}
      />

      <EventTicketModal
        event={{
          id: currentEvent.id,
          title: currentEvent.title,
          start_at: currentEvent.startAtISO,
          venue: currentEvent.location,
          address: currentEvent.location,
          description: currentEvent.description,
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
          showShareModal
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
        preselectedEventId={currentEvent.id}
      />

      <CommentModal isOpen={showCommentModal} onClose={() => setShowCommentModal(false)} eventId={currentEvent.id} eventTitle={currentEvent.title} />
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
      <div className={`p-3 rounded-full transition-all duration-200 ${active ? 'bg-red-500 shadow-lg shadow-red-500/30 scale-110' : 'bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-white/20'}`}>
        {children}
      </div>
      {typeof count !== 'undefined' && <span className="text-xs font-medium text-white drop-shadow-lg">{count}</span>}
    </button>
  );
}