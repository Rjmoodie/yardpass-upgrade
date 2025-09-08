import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateMetaTags, defaultMeta } from '@/utils/meta';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import { Heart, MessageCircle, Share, MoreVertical, Plus, Play, Image as ImageIcon, TrendingUp, Clock } from 'lucide-react';
import { ShareModal } from '@/components/ShareModal';
import { PostCreatorModal } from '@/components/PostCreatorModal';
import { CommentModal } from '@/components/CommentModal';
import { PaymentSuccessHelper } from '@/components/PaymentSuccessHelper';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { useHomeFeed } from '@/hooks/useHomeFeed';
import { useRealtimePosts } from '@/hooks/useRealtimePosts';

type MediaKind = 'image' | 'video' | 'none';

interface EventPost {
  id: string;
  authorId?: string;              // NEW: so we can link to profile
  authorName: string;
  authorBadge: 'ORGANIZER' | 'ATTENDEE';
  isOrganizer?: boolean;
  content: string;
  timestamp: string;
  likes: number;
  mediaType?: MediaKind;
  mediaUrl?: string;
  thumbnailUrl?: string;
  commentCount?: number;
  ticketBadge?: string;
}

interface TicketTier { id: string; name: string; price: number; badge: string; available: number; total: number; }

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
  totalComments?: number;
}

/* ----------------------------------------
   PostHero: full-screen media with overlay
-----------------------------------------*/
function PostHero({
  post,
  event,
  onOpenTickets,
}: {
  post?: EventPost;
  event: Event;
  onOpenTickets: () => void;
}) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  // Autoplay & (optional) HLS handling
  useEffect(() => {
    const v = videoRef.current;
    if (!v || post?.mediaType !== 'video' || !post.mediaUrl) return;

    // If it's HLS (.m3u8) and the browser can’t play it natively, try hls.js if available
    const isHls = /\.m3u8($|\?)/i.test(post.mediaUrl);
    const canPlayHlsNatively = v.canPlayType('application/vnd.apple.mpegurl');

    const setup = async () => {
      try {
        if (isHls && !canPlayHlsNatively) {
          // Optional dynamic import; will no-op if not installed
          const mod = await import(/* @vite-ignore */ 'hls.js').catch(() => null as any);
          const Hls = mod?.default;
          if (Hls?.isSupported()) {
            const hls = new Hls();
            hls.loadSource(post.mediaUrl!);
            hls.attachMedia(v);
          } else {
            // Fallback to just setting the src; Safari/iOS will work
            v.src = post.mediaUrl!;
          }
        }
      } catch {
        // ignore
      } finally {
        v.muted = true; // mobile autoplay requirement
        v.play().catch(() => {});
      }
    };
    setup();
  }, [post?.id, post?.mediaUrl, post?.mediaType]);

  if (!post) return null;

  const goEventDetails = () => navigate(routes.eventDetails(event.id));
  const goOrganizer = () => navigate(routes.org(event.organizerId));
  const goAuthor = () => {
    // If we have authorId and your routes expose a user profile route, use it here.
    // Fallback: open event posts filtered by author param (harmless if ignored).
    if (post.authorId && (routes as any)?.userById) {
      // @ts-ignore
      navigate((routes as any).userById(post.authorId));
    } else {
      navigate(`${routes.eventDetails(event.id)}?tab=posts&author=${encodeURIComponent(post.authorName)}`);
    }
  };

  // VIDEO
  if (post.mediaType === 'video' && post.mediaUrl) {
    return (
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          // If not HLS, let the video tag handle the src directly
          src={!/\.m3u8($|\?)/i.test(post.mediaUrl) ? post.mediaUrl : undefined}
          className="w-full h-full object-cover"
          autoPlay
          muted={muted}
          loop
          playsInline
          controls={false}
          preload="metadata"
          controlsList="nodownload noplaybackrate nofullscreen"
          // Let overlay buttons be clickable
          style={{ pointerEvents: 'none' }}
        />
        {/* Tap-to-unmute control */}
        <button
          onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
          className="absolute top-16 right-4 bg-black/60 text-white rounded-full px-3 py-1 text-xs z-20"
          style={{ pointerEvents: 'auto' }}
        >
          {muted ? 'Tap for sound' : 'Mute'}
        </button>

        {/* Bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-10" style={{ pointerEvents: 'auto' }}>
          {/* Post header line: author (clickable) + optional ticket badge */}
          <div className="flex items-center gap-2 mb-2">
            <Avatar className="w-7 h-7">
              <AvatarFallback className="text-xs bg-white/20 text-white">
                {post.authorName?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <button onClick={goAuthor} className="text-white text-sm font-semibold underline underline-offset-2">
              {post.authorName}
            </button>
            {post.authorBadge && (
              <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                {post.authorBadge}
              </span>
            )}
            {post.ticketBadge && (
              <button
                onClick={goEventDetails}
                className="ml-1 text-[10px] bg-black/40 border border-white/20 px-1.5 py-0.5 rounded text-white/90"
              >
                {post.ticketBadge}
              </button>
            )}
          </div>

          {/* Post text */}
          {post.content && (
            <div className="text-white/95 text-sm mb-3 line-clamp-3">
              {post.content}
            </div>
          )}

          {/* Event context card */}
          <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                {/* Event name (clickable) */}
                <button onClick={goEventDetails} className="font-semibold text-sm text-white truncate text-left underline underline-offset-2">
                  {event.title}
                </button>
                {/* Organizer (clickable) */}
                <div className="flex items-center gap-1 text-xs text-gray-300">
                  <span>by</span>
                  <button onClick={goOrganizer} className="underline underline-offset-2">
                    {event.organizer}
                  </button>
                </div>
                <p className="text-xs text-gray-300 truncate">
                  {event.dateLabel} • {event.location}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="glass"
                  onClick={goEventDetails}
                  className="bg-white/20 text-white border-white/30 hover:bg-white/30 text-xs"
                >
                  Details
                </Button>
                <Button
                  size="sm"
                  variant="premium"
                  onClick={onOpenTickets}
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

  // IMAGE
  return (
    <div className="absolute inset-0">
      <ImageWithFallback src={post.mediaUrl || post.thumbnailUrl || ''} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
    </div>
  );
}

/* ----------------------------------------
   RecentPostsRail — unchanged visual,
   kept here in case you want it later.
-----------------------------------------*/
function RecentPostsRail({
  posts,
  onPostClick,
  onViewAllClick,
}: {
  posts: EventPost[];
  onPostClick: (postId: string) => void;
  onViewAllClick: () => void;
}) {
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});

  if (!posts || posts.length === 0) {
    return (
      <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
        <p className="text-sm text-gray-300 text-center">Be the first to post about this event!</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Recent Posts</h4>
        <button onClick={onViewAllClick} className="text-xs text-primary hover:text-primary/80 font-medium">
          View All
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {posts.map((post) => (
          <button
            key={post.id}
            onClick={() => onPostClick(post.id)}
            className="flex-shrink-0 w-24 h-24 bg-white/10 rounded-lg border border-white/20 hover:bg-white/15 transition-all duration-200 relative group"
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
          </button>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------
   Main Page
-----------------------------------------*/
export default function Index() {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortByActivity, setSortByActivity] = useState(false);
  const { withAuth, requireAuth } = useAuthGuard();
  const navigate = useNavigate();

  // Home feed (RPC)
  const { data: feed, loading: feedLoading, error, setData: setFeed } = useHomeFeed(3);

  useEffect(() => {
    setEvents(feed || []);
    setLoading(feedLoading);
    if (error) {
      console.error('Home feed error:', error);
      toast({
        title: 'Failed to load feed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [feed, feedLoading, error]);

  // Realtime posts
  useRealtimePosts(
    events.map((e) => e.id),
    (p) => {
      setFeed((prev: any) => {
        const next = (prev || []).map((ev: Event) => {
          if (ev.id !== p.event_id) return ev;
          const url = (p.media_urls && p.media_urls[0]) || undefined;
          const isVideo =
            url ? /mux|\.mp4$|\.mov$|\.m3u8$/i.test(url) : false;
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

  // Clamp
  const safeIndex = Math.max(0, Math.min(currentIndex, events.length - 1));
  const currentEvent = events[safeIndex];

  useEffect(() => { updateMetaTags(defaultMeta); }, []);

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

  // Touch swipe – attach to container so buttons stay clickable
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) setCurrentIndex((i) => (diff > 0 ? Math.min(events.length - 1, i + 1) : Math.max(0, i - 1)));
    touchStartY.current = null;
  };

  // Optimistic from PostCreatorModal (kept)
  useEffect(() => {
    const handlePostCreated = (event: CustomEvent) => {
      const { eventId, postData } = event.detail || {};
      if (!eventId || !postData) return;
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id !== eventId) return ev;
          const newPost: EventPost = {
            id: postData.id || `temp-${Date.now()}`,
            authorName: postData.authorName || 'You',
            authorBadge: postData.isOrganizer ? 'ORGANIZER' : 'ATTENDEE',
            isOrganizer: !!postData.isOrganizer,
            content: postData.content || '',
            timestamp: new Date().toLocaleDateString(),
            likes: 0,
            mediaType: postData.mediaType,
            mediaUrl: postData.mediaUrl,
            thumbnailUrl: postData.thumbnailUrl,
            commentCount: 0,
          };
          const posts = [newPost, ...(ev.posts || [])].slice(0, 3);
          return { ...ev, posts };
        })
      );
      toast({ title: 'Post created!', description: 'Your post has been added.' });
    };
    window.addEventListener('postCreated', handlePostCreated as EventListener);
    return () => window.removeEventListener('postCreated', handlePostCreated as EventListener);
  }, []);

  const handleLike = useCallback(
    withAuth((eventId: string) => {
      setEvents((prev) =>
        prev.map((ev) => (ev.id === eventId ? { ...ev, isLiked: !ev.isLiked, likes: ev.isLiked ? ev.likes - 1 : ev.likes + 1 } : ev))
      );
    }, 'Please sign in to like events'),
    []
  );

  const handleShare = useCallback((ev: Event) => { capture('share_click', { event_id: ev.id }); setShowShareModal(true); }, []);
  const handleComment = useCallback(withAuth(() => setShowCommentModal(true), 'Please sign in to comment'), []);
  const handleMore = useCallback(withAuth(() => toast({ title: 'More Options', description: 'Coming soon…' }), 'Please sign in'), []);
  const goTo = useCallback((i: number) => setCurrentIndex(Math.max(0, Math.min(events.length - 1, i))), [events.length]);

  const handlePostClick = useCallback(
    (postId: string) => currentEvent && navigate(`${routes.eventDetails(currentEvent.id)}?tab=posts&post=${postId}`),
    [navigate, currentEvent?.id]
  );
  const handleViewAllPosts = useCallback(
    () => currentEvent && navigate(`${routes.eventDetails(currentEvent.id)}?tab=posts`),
    [navigate, currentEvent?.id]
  );

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
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
        <Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <div
      className="h-screen relative overflow-hidden bg-black"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/60 to-transparent p-4">
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
              {sortByActivity ? (<><TrendingUp className="w-4 h-4" /><span className="text-xs font-medium">Active</span></>) : (<><Clock className="w-4 h-4" /><span className="text-xs font-medium">Upcoming</span></>)}
            </button>
            <Button
              size="sm"
              variant="glass"
              onClick={() => requireAuth(() => setPostCreatorOpen(true), 'Please sign in to create posts')}
              className="bg-white/20 text-white border-white/30 hover:bg-white/30 min-h-[40px] px-3 font-semibold backdrop-blur-md shadow-lg"
            >
              + Create Post
            </Button>
          </div>
        </div>
      </div>

      {/* Slides track */}
      <div
        className="h-full w-full relative transition-transform duration-300 ease-out"
        style={{ transform: `translateY(-${currentIndex * 100}%)` }}
      >
        {events.map((ev, i) => {
          const heroPost = (ev.posts || []).find(p => p.mediaUrl);
          return (
            <div key={ev.id} className="h-full w-full absolute" style={{ top: `${i * 100}%` }}>
              {heroPost ? (
                <PostHero
                  post={heroPost}
                  event={ev}
                  onOpenTickets={() => requireAuth(() => setShowTicketModal(true), 'Please sign in to purchase tickets')}
                />
              ) : (
                <>
                  <ImageWithFallback src={ev.coverImage} alt={ev.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
                  <div className="absolute bottom-20 left-4 right-4 text-white z-20" style={{ pointerEvents: 'auto' }}>
                    <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4">
                      <h2 className="text-xl font-bold mb-2">{ev.title}</h2>
                      <p className="text-sm text-gray-300 mb-3">{ev.description}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="glass" onClick={() => navigate(routes.eventDetails(ev.id))} className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                          Details
                        </Button>
                        <Button size="sm" variant="premium" onClick={() => requireAuth(() => setShowTicketModal(true), 'Please sign in to purchase tickets')} className="bg-primary text-primary-foreground hover:bg-primary/90">
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
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
        <div className="flex flex-col items-center gap-4 text-white select-none">
          <IconButton ariaLabel="Like" active={currentEvent.isLiked} count={currentEvent.likes} onClick={() => handleLike(currentEvent.id)}>
            <Heart className={`w-6 h-6 ${currentEvent.isLiked ? 'fill-white text-white' : 'text-white'}`} />
          </IconButton>
          <IconButton ariaLabel="Comments" count={(currentEvent as any)?.totalComments ?? 0} onClick={() => handleComment()}>
            <MessageCircle className="w-6 h-6 text-white" />
          </IconButton>
          <IconButton ariaLabel="Create post" onClick={() => requireAuth(() => setPostCreatorOpen(true), 'Please sign in to create posts')}>
            <div className="p-3 rounded-full bg-primary/80 backdrop-blur-sm border border-primary/50 hover:bg-primary transition-all duration-200 shadow-lg"><Plus className="w-6 h-6 text-white" /></div>
            <span className="text-xs font-medium text-white drop-shadow-lg">Post</span>
          </IconButton>
          <IconButton ariaLabel="Share" count={currentEvent.shares} onClick={() => handleShare(currentEvent)}>
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
          <button key={i} aria-label={`Go to event ${i + 1}`} onClick={() => goTo(i)} className={`w-1.5 h-8 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`} />
        ))}
      </div>

      {/* Modals */}
      <AttendeeListModal isOpen={showAttendeeModal} onClose={() => setShowAttendeeModal(false)} eventTitle={currentEvent.title} attendeeCount={currentEvent.attendeeCount} attendees={[]} />

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