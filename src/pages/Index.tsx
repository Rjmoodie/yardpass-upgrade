// src/pages/Index.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateMetaTags, defaultMeta } from '@/utils/meta';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import { Heart, MessageCircle, Share, TrendingUp, Clock, Plus } from 'lucide-react';
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
import { extractMuxPlaybackId } from '@/utils/mux';
import { ReportButton } from '@/components/ReportButton';
import { supabase } from '@/integrations/supabase/client';

import { Event, EventPost } from '@/types/events';
import { PostHero } from '@/components/PostHero';
import { RecentPostsRail } from '@/components/RecentPostsRail';

interface IndexProps {
  onEventSelect: (event: Event) => void;
  onCreatePost: () => void;
  onCategorySelect?: (category: string) => void;
  onOrganizerSelect?: (organizerId: string, organizerName: string) => void;
}

function IconButton({
  children, onClick, count, active, ariaLabel,
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
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
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
  const fetchedFor = useRef<Set<string>>(new Set()); // prevents refetch loops
  const isMounted = useRef(true);

  const { withAuth, requireAuth } = useAuthGuard();
  const navigate = useNavigate();

  // Feed via RPC - affinity feed
  const { data: feed, loading: feedLoading, error, setData: setFeed } = useAffinityFeed(8);

  // Map feed -> Event[]
  const mappedEvents: Event[] = useMemo(() => {
    return (feed || []).map((ev: any) => ({
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
  }, [feed]);

  // set events from feed
  useEffect(() => {
    setEvents(mappedEvents);
    setLoading(feedLoading);
    if (error) {
      console.error('Home feed error:', error);
      toast({ title: 'Failed to load events', description: 'Please try refreshing the page.', variant: 'destructive' });
    }
  }, [mappedEvents, feedLoading, error]);

  // Initial posts loader — only for new, unseen event IDs
  useEffect(() => {
    isMounted.current = true;
    const idsNeedingPosts = events
      .filter((e) => !fetchedFor.current.has(e.id))
      .map((e) => e.id);

    if (!idsNeedingPosts.length) return;

    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_event_posts', {
          p_event_ids: idsNeedingPosts,
          p_k: 3,
        });

        if (error) throw error;

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
          arr.push(mapped);
          grouped.set(p.event_id, arr);
        }

        if (!isMounted.current) return;
        setEvents((prev) =>
          prev.map((ev) => (grouped.has(ev.id) ? { ...ev, posts: grouped.get(ev.id) } : ev))
        );

        idsNeedingPosts.forEach((id) => fetchedFor.current.add(id));
      } catch (err) {
        console.error('Initial posts fetch failed:', err);
      }
    })();

    return () => { isMounted.current = false; };
  }, [events]);

  // Realtime posts — prepend newest into event.posts
  useRealtimePosts(
    events.map((e) => e.id),
    (p) => {
      setFeed((prev: any[]) => {
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

  // Sort toggle: ranked vs activity
  useEffect(() => {
    if (!sortByActivity) return;
    setEvents((prev) => {
      const score = (ev: Event) => {
        const postAgg = (ev.posts || []).reduce((s, p) => s + (p.likes || 0) + (p.commentCount || 0), 0);
        const att = ev.attendeeCount || 0;
        return postAgg * 2 + att;
      };
      const copy = [...prev];
      copy.sort((a, b) => score(b) - score(a));
      return copy;
    });
  }, [sortByActivity]);

  // Meta
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

  // Preload neighbor covers
  useEffect(() => {
    const next = events[currentIndex + 1]?.coverImage;
    const prev = events[currentIndex - 1]?.coverImage;
    [next, prev].filter(Boolean).forEach((src) => { const img = new Image(); img.src = src as string; });
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
    withAuth((pid?: string, post?: EventPost) => {
      setCommentPostId(pid);
      const playbackId = extractMuxPlaybackId(post?.mediaUrl);
      setCommentMediaId(playbackId ?? undefined);
      setShowCommentModal(true);
    }, 'Please sign in to comment on events'),
    [withAuth]
  );

  const handleComment = useCallback(() => {
    if (!currentEvent) return;
    const heroPost = (currentEvent.posts || []).find((p) => !!p.mediaUrl) || (currentEvent.posts || [])[0];
    openCommentsForPost(heroPost?.id, heroPost);
  }, [currentEvent, openCommentsForPost]);

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
        <Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
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
                <>
                  <PostHero
                    post={heroPost}
                    event={ev}
                    onOpenTickets={() => requireAuth(() => setShowTicketModal(true), 'Please sign in to purchase tickets')}
                    isActive={i === Math.max(0, Math.min(currentIndex, events.length - 1))}
                    onPostClick={(pid) => openCommentsForPost(pid, heroPost)}
                  />
                  {/* Recent rail only for image slides / below overlay in your original — optional: place under header */}
                  {ev.posts?.length ? (
                    <div className="absolute inset-x-0 bottom-0 p-4 pointer-events-none">
                      <div className="pointer-events-auto">
                        <RecentPostsRail
                          posts={ev.posts}
                          onPostClick={(pid, p) => openCommentsForPost(pid, p)}
                          onViewAllClick={() => navigate(`${routes.event(ev.id)}?tab=posts`)}
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <img src={ev.coverImage} alt={ev.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
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
        style={{ pointerEvents: 'auto', touchAction: 'pan-y', top: '12%', bottom: '32%', left: 0, right: '20%' }}
        onTouchStart={(e) => { (e.currentTarget as any).__startY = e.touches[0].clientY; }}
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
            ? { title: currentEvent.title, text: `Check out ${currentEvent.title} - ${currentEvent.description}`, url: typeof window !== 'undefined' ? window.location.href : '' }
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
        onClose={() => { setShowCommentModal(false); setCommentPostId(undefined); setCommentMediaId(undefined); }}
        eventId={currentEvent?.id || ''}
        eventTitle={currentEvent?.title || ''}
        postId={commentPostId}
        mediaPlaybackId={commentMediaId}
      />
    </div>
  );
}