// src/pages/Index.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateMetaTags, defaultMeta } from '@/utils/meta';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { ShareModal } from '@/components/ShareModal';
import { PostCreatorModal } from '@/components/PostCreatorModal';
import CommentModal from '@/components/CommentModal';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useUnifiedFeed } from '@/hooks/useUnifiedFeed';
import { EventCard } from '@/components/EventCard';
import { UserPostCard } from '@/components/UserPostCard';
import { supabase } from '@/integrations/supabase/client';

interface IndexProps {
  onEventSelect: (eventId: string) => void;
  onCreatePost: () => void;
  onCategorySelect?: (category: string) => void;
  onOrganizerSelect?: (organizerId: string, organizerName: string) => void;
}

export default function Index({ onEventSelect, onCreatePost }: IndexProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | undefined>(undefined);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);

  // Audio & playback
  const [soundEnabled, setSoundEnabled] = useState(false); // default muted
  const [playingVideos, setPlayingVideos] = useState<Set<number>>(new Set());

  const { withAuth, requireAuth } = useAuthGuard();
  const navigate = useNavigate();

  // Keep user id in sync with auth state (handles login/logout while on page)
  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setUserId(sess?.user?.id);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Unified feed
  const { items, loading, error, prependItem, hasMore, loadMore, refresh } = useUnifiedFeed(userId);

  useEffect(() => {
    if (error) {
      console.error('Feed error:', error);
      toast({ title: 'Failed to load feed', description: 'Please try refreshing the page.', variant: 'destructive' });
    }
  }, [error]);

  // === Realtime for new posts (INSERT) ===
  // Subscribes only to the set of event_ids currently on screen.
  const eventIds = useMemo(
    () => Array.from(new Set(items.map(i => i.event_id))).sort(),
    [items]
  );

  useEffect(() => {
    if (!eventIds.length) return;

    const filter = `event_id=in.(${eventIds.map(id => `"${id}"`).join(',')})`;

    const channel = supabase
      .channel(`unified-feed-${eventIds.join('-').slice(0, 60)}`, { config: { broadcast: { ack: true } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_posts', filter },
        async (payload) => {
          try {
            const postId = (payload.new as any).id;
            // Fetch normalized feed item for this post (server keeps shape consistent)
            const { data, error } = await supabase.rpc('get_feed_item_for_post', {
              p_user: userId || null,
              p_post_id: postId,
            });
            if (error) throw error;
            const item = Array.isArray(data) ? data[0] : data;
            if (item) prependItem(item as any);
          } catch (e) {
            // Soft-fail; realtime is best-effort
            console.warn('Realtime fetch error:', e);
          }
        }
      )
      .subscribe(status => {
        // Optional: console.debug('Realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventIds.join('|'), prependItem, userId]);

  // Meta tags
  useEffect(() => { updateMetaTags(defaultMeta); }, []);

  // Keep index in bounds if items length changes (e.g., new prepend)
  useEffect(() => {
    setCurrentIndex((i) => Math.min(Math.max(0, i), Math.max(0, items.length - 1)));
  }, [items.length]);

  // Keyboard nav (↑/↓, PgUp/PgDn, Home/End, "s" toggles sound)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'PageUp'].includes(e.key)) setCurrentIndex((i) => Math.max(0, i - 1));
      if (['ArrowDown', 'PageDown'].includes(e.key)) setCurrentIndex((i) => Math.min(items.length - 1, i + 1));
      if (e.key === 'Home') setCurrentIndex(0);
      if (e.key === 'End') setCurrentIndex(Math.max(0, items.length - 1));
      if (e.key.toLowerCase() === 's') handleSoundToggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Touch swipe (vertical)
  const touchStartRef = useRef<{ y: number; t: number } | null>(null);
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchStartRef.current = { y: t.clientY, t: Date.now() };
    };
    const onTouchEnd = (e: TouchEvent) => {
      const start = touchStartRef.current;
      if (!start) return;
      const dy = (e.changedTouches[0]?.clientY ?? start.y) - start.y;
      const dt = Date.now() - start.t;
      // Quick swipe threshold
      if (dt < 800 && Math.abs(dy) > 50) {
        if (dy < 0) setCurrentIndex((i) => Math.min(items.length - 1, i + 1));
        else setCurrentIndex((i) => Math.max(0, i - 1));
      }
      touchStartRef.current = null;
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart as any);
      window.removeEventListener('touchend', onTouchEnd as any);
    };
  }, [items.length]);

  // Preload next page when we're near the end
  useEffect(() => {
    if (!loading && hasMore && currentIndex >= items.length - 3) {
      loadMore().catch(() => {/* surface via hook error if any */});
    }
  }, [currentIndex, items.length, hasMore, loadMore, loading]);

  // Video control: only touch the current / prev / next item for perf
  useEffect(() => {
    const indices = new Set([currentIndex - 1, currentIndex, currentIndex + 1].filter(i => i >= 0 && i < items.length));
    const nextPlaying = new Set<number>(playingVideos);

    indices.forEach((idx) => {
      const el = document.querySelector<HTMLVideoElement>(`[data-feed-index="${idx}"] video`);
      if (!el) return;

      if (idx === currentIndex) {
        el.muted = !soundEnabled;
        el.play().then(() => {
          nextPlaying.add(idx);
        }).catch(() => {/* ignore autoplay failures */});
      } else {
        el.muted = true;
        el.pause();
        nextPlaying.delete(idx);
      }
    });

    // Pause any previously playing videos outside the window
    playingVideos.forEach((idx) => {
      if (!indices.has(idx)) {
        const el = document.querySelector<HTMLVideoElement>(`[data-feed-index="${idx}"] video`);
        if (el) el.pause();
        nextPlaying.delete(idx);
      }
    });

    if (nextPlaying.size !== playingVideos.size) {
      setPlayingVideos(nextPlaying);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, soundEnabled, items.length]);

  // Actions
  const handleLike = useCallback(
    withAuth(async (postId: string) => {
      try {
        const { error } = await supabase.functions.invoke('reactions-toggle', {
          body: { post_id: postId, kind: 'like' }
        });
        if (error) throw error;
        refresh();
        toast({ title: 'Liked!', description: 'Your reaction has been added.' });
      } catch (err) {
        console.error('Like error:', err);
        toast({ title: 'Error', description: 'Failed to like post', variant: 'destructive' });
      }
    }, 'Please sign in to like posts'),
    [withAuth, refresh]
  );

  const handleComment = useCallback(
    withAuth((postId: string) => {
      setCommentPostId(postId);
      setShowCommentModal(true);
    }, 'Please sign in to comment'),
    [withAuth]
  );

  const handleShare = useCallback((_postId: string) => {
    setShowShareModal(true);
  }, []);

  const handleAuthorClick = useCallback((authorId: string) => {
    navigate(`/profile/${authorId}`);
  }, [navigate]);

  const handleEventClick = useCallback((eventId: string) => {
    onEventSelect(eventId);
  }, [onEventSelect]);

  const handleOpenTickets = useCallback((eventId: string) => {
    // (Optional) analytics here
    setSelectedEventId(eventId);
    setShowTicketModal(true);
  }, []);

  const goTo = useCallback(
    (i: number) => setCurrentIndex(Math.max(0, Math.min(items.length - 1, i))),
    [items.length]
  );

  const currentItem = items[Math.max(0, Math.min(currentIndex, items.length - 1))];

  const handleVideoToggle = useCallback((index: number) => {
    const el = document.querySelector<HTMLVideoElement>(`[data-feed-index="${index}"] video`);
    if (!el) return;
    const isPlaying = playingVideos.has(index);
    if (isPlaying) {
      el.pause();
      setPlayingVideos(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    } else {
      el.play().then(() => {
        setPlayingVideos(prev => new Set(prev).add(index));
      }).catch(() => {/* ignore */});
    }
  }, [playingVideos]);

  const handleSoundToggle = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      // Mute all first
      document.querySelectorAll<HTMLVideoElement>('video').forEach(v => (v.muted = true));
      // Unmute current if enabling
      if (next) {
        const el = document.querySelector<HTMLVideoElement>(`[data-feed-index="${currentIndex}"] video`);
        if (el) el.muted = false;
      }
      return next;
    });
  }, [currentIndex]);

  if (loading && !items.length) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-36 h-32 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <img src="/yardpass-logo.png" alt="YardPass" className="w-24 h-20" />
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">No Content Found</h1>
        <p className="text-muted-foreground mb-4">There are currently no posts or events to display.</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="feed-page h-screen relative overflow-hidden bg-black" style={{ touchAction: 'pan-y' }}>
      {/* Logo */}
      <div className="fixed left-2 top-2 z-30">
        <img
          src="/yardpass-logo.png"
          alt="YardPass"
          className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 object-contain"
        />
      </div>

      {/* Feed Items (one-per-screen vertical rail) */}
      <div
        className="h-full w-full relative transition-transform duration-300 ease-out will-change-transform"
        style={{ transform: `translateY(-${currentIndex * 100}%)` }}
      >
        {items.map((item, i) => (
          <div
            key={`${item.item_type}:${item.item_id}`}
            className="h-full w-full absolute"
            style={{ top: `${i * 100}%` }}
            data-feed-index={i}
            aria-label={`Feed item ${i + 1} of ${items.length}`}
          >
            {item.item_type === 'event' ? (
              <EventCard
                item={item}
                onOpenTickets={handleOpenTickets}
                onEventClick={handleEventClick}
                onCreatePost={() => requireAuth(() => onCreatePost(), 'Please sign in to create posts')}
                onReport={() => {}}
                onSoundToggle={handleSoundToggle}
                soundEnabled={soundEnabled}
                onVideoToggle={() => handleVideoToggle(i)}
                isVideoPlaying={playingVideos.has(i)}
              />
            ) : (
              <UserPostCard
                item={item}
                onLike={withAuth((postId) => handleLike(postId), 'Please sign in to like posts')}
                onComment={withAuth((postId) => handleComment(postId), 'Please sign in to comment')}
                onShare={(postId) => handleShare(postId)}
                onEventClick={handleEventClick}
                onAuthorClick={handleAuthorClick}
                onCreatePost={() => requireAuth(() => onCreatePost(), 'Please sign in to create posts')}
                onReport={() => {}}
                onSoundToggle={handleSoundToggle}
                soundEnabled={soundEnabled}
                onVideoToggle={() => handleVideoToggle(i)}
                isVideoPlaying={playingVideos.has(i)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Navigation controls */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10 pointer-events-none">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="p-2 rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/60 transition disabled:opacity-50 pointer-events-auto"
            aria-label="Previous item"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center gap-1 max-h-32 overflow-y-auto">
            {items.slice(Math.max(0, currentIndex - 3), currentIndex + 4).map((item, i) => {
              const actualIndex = Math.max(0, currentIndex - 3) + i;
              return (
                <button
                  key={`${item.item_type}:${item.item_id}`}
                  aria-label={`Go to ${item.item_type} ${actualIndex + 1}`}
                  onClick={() => goTo(actualIndex)}
                  className={`w-1 h-6 rounded-full transition-all duration-200 pointer-events-auto ${
                    actualIndex === currentIndex ? 'bg-white shadow-lg' : 'bg-white/40 hover:bg-white/70'
                  }`}
                />
              );
            })}
          </div>

          <button
            onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={currentIndex === items.length - 1}
            className="p-2 rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/60 transition disabled:opacity-50 pointer-events-auto"
            aria-label="Next item"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modals */}
      <AttendeeListModal
        isOpen={showAttendeeModal}
        onClose={() => setShowAttendeeModal(false)}
        eventTitle={currentItem?.event_title || 'Event'}
        attendeeCount={0}
        attendees={[]}
      />

      <EventTicketModal
        isOpen={showTicketModal}
        onClose={() => {
          setShowTicketModal(false);
          setSelectedEventId(null);
        }}
        event={selectedEventId ? (() => {
          const feedItem = items.find(
            it => it.item_type === 'event' && it.item_id === selectedEventId
          ) as Extract<typeof items[0], { item_type: 'event' }> | undefined;

          return feedItem
            ? {
                id: feedItem.event_id,
                title: feedItem.event_title,
                start_at: feedItem.event_starts_at,
                venue: (feedItem as any).event_location ?? undefined,
                description: (feedItem as any).event_description ?? undefined
              }
            : null;
        })() : null}
        onSuccess={() => {
          setShowTicketModal(false);
          setSelectedEventId(null);
        }}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        payload={currentItem ? {
          title: currentItem.event_title,
          text: `Check out this event: ${currentItem.event_title}`,
          url: `${window.location.origin}/e/${currentItem.event_id}`
        } : null}
      />

      <PostCreatorModal
        isOpen={postCreatorOpen}
        onClose={() => setPostCreatorOpen(false)}
        preselectedEventId={currentItem?.event_id}
      />

      {showCommentModal && commentPostId && currentItem && (
        <CommentModal
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setCommentPostId(undefined);
          }}
          eventId={currentItem.event_id}
          eventTitle={currentItem.event_title}
          postId={commentPostId}
          onSuccess={() => {
            // Refresh feed to show new comment count
            refresh();
          }}
        />
      )}
    </div>
  );
}