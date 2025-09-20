// src/pages/Index.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { updateMetaTags, defaultMeta } from '@/utils/meta';
import { EventTicketModal } from '@/components/EventTicketModal';
import { AttendeeListModal } from '@/components/AttendeeListModal';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
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
import { SearchPalette } from '@/components/SearchPalette';

interface IndexProps {
  onEventSelect: (eventId: string) => void;
  onCreatePost: () => void;
  onCategorySelect?: (category: string) => void;
  onOrganizerSelect?: (organizerId: string, organizerName: string) => void;
}

export default function Index({ onEventSelect, onCreatePost }: IndexProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // 🗨️ Comments
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | undefined>(undefined);
  const [commentMediaPlaybackId, setCommentMediaPlaybackId] = useState<string | undefined>(undefined); // ✨ NEW

  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
      .subscribe(() => {});

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

  // Keyboard nav (+ quick comment with "c") ✨ NEW
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Search hotkeys
      const isMac = navigator.platform.toLowerCase().includes('mac');
      if ((isMac && e.metaKey && e.key.toLowerCase() === 'k') ||
          (!isMac && e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === '/') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && !(e.target as HTMLElement).isContentEditable) {
          e.preventDefault();
          setSearchOpen(true);
          return;
        }
      }

      // Disable feed nav while comment modal is open
      if (showCommentModal) return; // ✨ NEW

      if (['ArrowUp', 'PageUp'].includes(e.key)) setCurrentIndex((i) => Math.max(0, i - 1));
      if (['ArrowDown', 'PageDown'].includes(e.key)) setCurrentIndex((i) => Math.min(items.length - 1, i + 1));
      if (e.key === 'Home') setCurrentIndex(0);
      if (e.key === 'End') setCurrentIndex(Math.max(0, items.length - 1));
      if (e.key.toLowerCase() === 's') handleSoundToggle();

      // Quick open comments on current post
      if (e.key.toLowerCase() === 'c') { // ✨ NEW
        const item = items[currentIndex];
        if (item?.item_type === 'post') {
          e.preventDefault();
          handleComment(item.item_id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, currentIndex, showCommentModal]); // ✨ NEW

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
      if (showCommentModal) { // ✨ NEW: freeze swipe while modal is open
        touchStartRef.current = null;
        return;
      }
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
  }, [items.length, showCommentModal]); // ✨ NEW

  // Preload next page when near end
  useEffect(() => {
    if (!loading && hasMore && currentIndex >= items.length - 3) {
      loadMore().catch(() => {/* surface via hook error if any */});
    }
  }, [currentIndex, items.length, hasMore, loadMore, loading]);

  // Video control: auto-play current video, pause others
  useEffect(() => {
    const indices = new Set([currentIndex - 1, currentIndex, currentIndex + 1].filter(i => i >= 0 && i < items.length));
    setPlayingVideos(prev => {
      const next = new Set<number>();
      const currentArray = Array.from(prev);
      const newArray: number[] = [];
      indices.forEach(idx => {
        if (idx === currentIndex) newArray.push(idx);
      });
      if (currentArray.length !== newArray.length || !currentArray.every(item => newArray.includes(item))) {
        return new Set(newArray);
      }
      return prev;
    });

    // Control actual video elements with improved error handling
    requestAnimationFrame(() => {
      items.forEach((item, idx) => {
        const feedElement = document.querySelector(`[data-feed-index="${idx}"]`);
        const videoElement = feedElement?.querySelector('video') as HTMLVideoElement;
        if (!videoElement) return;

        // ✨ NEW: if comment modal is open, pause and mute everything
        if (showCommentModal) {
          if (!videoElement.paused) videoElement.pause();
          videoElement.muted = true;
          return;
        }

        if (idx === currentIndex && item.item_type === 'post') {
          videoElement.muted = !soundEnabled;
          if (videoElement.readyState >= 2) {
            videoElement.currentTime = 0;
            videoElement.play().catch((err) => {
              console.log('Index: Video autoplay failed for item', idx, err);
              if (!videoElement.muted) {
                videoElement.muted = true;
                videoElement.play().catch(() => {});
              }
            });
          } else {
            const handleCanPlay = () => {
              videoElement.currentTime = 0;
              videoElement.play().catch(() => {});
              videoElement.removeEventListener('canplay', handleCanPlay);
            };
            videoElement.addEventListener('canplay', handleCanPlay);
          }
        } else {
          if (!videoElement.paused) videoElement.pause();
        }
      });
    });
  }, [currentIndex, soundEnabled, items.length, items, showCommentModal]); // ✨ NEW dep: showCommentModal, items

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

  // Open comment modal (optional playbackId support) ✨ NEW
  const handleComment = useCallback(
    withAuth((postId: string, playbackId?: string) => {
      setCommentPostId(postId);
      setCommentMediaPlaybackId(playbackId); // can be undefined if not provided
      setShowCommentModal(true);

      // Soft pause/mute current video's audio immediately for UX ✨ NEW
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLVideoElement>(`[data-feed-index="${currentIndex}"] video`);
        if (el) { try { el.pause(); } catch {} el.muted = true; }
      });
    }, 'Please sign in to comment'),
    [withAuth, currentIndex]
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
    setSelectedEventId(eventId);
    setShowTicketModal(true);
  }, []);

  const goTo = useCallback(
    (i: number) => setCurrentIndex(Math.max(0, Math.min(items.length - 1, i))),
    [items.length]
  );

  const currentItem = items[Math.max(0, Math.min(currentIndex, items.length - 1))];

  const handleVideoToggle = useCallback((index: number) => {
    setPlayingVideos(prev => {
      const next = new Set(prev);
      if (prev.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

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

  // Search navigation handlers
  const goToEventFromSearch = useCallback((eventId: string) => {
    onEventSelect(eventId);
    const eventIndex = items.findIndex(item =>
      item.item_type === 'event' && item.item_id === eventId
    );
    if (eventIndex !== -1) setCurrentIndex(eventIndex);
  }, [onEventSelect, items]);

  const goToPostFromSearch = useCallback((eventId: string, postId: string) => {
    const postIndex = items.findIndex(item =>
      item.item_type === 'post' && item.item_id === postId
    );
    if (postIndex !== -1) {
      setCurrentIndex(postIndex);
    } else {
      onEventSelect(eventId);
    }
  }, [onEventSelect, items]);

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
    <div className="feed-page h-screen relative overflow-hidden bg-black smooth-feed-scroll" style={{ touchAction: 'pan-y' }}>
      {/* Logo */}
      <div className="fixed left-2 top-3 z-30">
        <img
          src="/yardpass-logo.png"
          alt="YardPass"
          className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 object-contain"
        />
      </div>

      {/* Search Button */}
      <div className="fixed right-3 top-3 z-30">
        <Button 
          variant="secondary" 
          size="icon"
          onClick={() => setSearchOpen(true)}
          className="bg-black/40 border border-white/20 text-white hover:bg-black/60 transition backdrop-blur-sm"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Feed Items with smooth transitions */}
      <div
        className="h-full w-full relative transition-transform duration-500 ease-out will-change-transform"
        style={{ 
          transform: `translateY(-${currentIndex * 100}%)`,
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {items.map((item, i) => (
          <div
            key={`${item.item_type}:${item.item_id}`}
            className="h-full w-full absolute feed-item"
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
                onComment={withAuth((postId /*, playbackId?*/) => handleComment(postId /*, playbackId*/), 'Please sign in to comment')} // ✨ NEW: handler supports optional playbackId
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
            disabled={currentIndex === 0 || showCommentModal} // ✨ NEW: lock while modal open
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
                  disabled={showCommentModal} // ✨ NEW
                  className={`w-1 h-6 rounded-full transition-all duration-200 pointer-events-auto ${
                    actualIndex === currentIndex ? 'bg-white shadow-lg' : 'bg-white/40 hover:bg-white/70'
                  } ${showCommentModal ? 'opacity-50' : ''}`}
                />
              );
            })}
          </div>

          <button
            onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={currentIndex === items.length - 1 || showCommentModal} // ✨ NEW
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
            setCommentMediaPlaybackId(undefined); // ✨ NEW
            // Try to restore audio state softly
            requestAnimationFrame(() => {
              const el = document.querySelector<HTMLVideoElement>(`[data-feed-index="${currentIndex}"] video`);
              if (el) { el.muted = !soundEnabled; }
            });
          }}
          eventId={currentItem.event_id}
          eventTitle={currentItem.event_title}
          postId={commentPostId}
          mediaPlaybackId={commentMediaPlaybackId} // ✨ NEW (CommentModal will resolve if provided)
          onSuccess={() => {
            // Refresh feed to show new comment count
            refresh();
          }}
        />
      )}

      <SearchPalette
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onGoToEvent={goToEventFromSearch}
        onGoToPost={goToPostFromSearch}
        categories={['Music', 'Sports', 'Tech', 'Food', 'Arts', 'Business & Professional', 'Community', 'Other']}
      />
    </div>
  );
}
