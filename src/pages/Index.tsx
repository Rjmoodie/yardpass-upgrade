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
import { muxToPoster } from '@/utils/media';
import { PreconnectMux } from '@/components/Perf/PreconnectMux';
import { WarmHlsOnIdle } from '@/components/Perf/WarmHlsOnIdle';
import { PreloadNextPoster } from '@/components/Perf/PreloadNextPoster';

interface IndexProps {
  onEventSelect: (eventId: string) => void;
  onCreatePost: () => void;
  onCategorySelect?: (category: string) => void;
  onOrganizerSelect?: (organizerId: string, organizerName: string) => void;
}

export default function Index({ onEventSelect, onCreatePost }: IndexProps) {
  // ---------- Local UI state ----------
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // 🗨️ Comments
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | undefined>(undefined);
  const [commentMediaPlaybackId, setCommentMediaPlaybackId] = useState<string | undefined>(undefined);

  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Audio & playback
  const [soundEnabled, setSoundEnabled] = useState(false); // default muted

  const { withAuth, requireAuth } = useAuthGuard();
  const navigate = useNavigate();

  // Keep user id in sync with auth state (no reloads)
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
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // ---------- Feed ----------
  const { items, loading, error, prependItem, hasMore, loadMore, refresh, bumpPostCommentCount, bumpPostLikeCount } = useUnifiedFeed(userId);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Failed to load feed',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [error]);

  // Unique, stable list of event_ids shown
  const eventIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.event_id))).sort(),
    [items]
  );

  // Sub: when a new post is added for currently visible events, prepend its normalized feed item
  useEffect(() => {
    if (!eventIds.length) return;

    const filter = `event_id=in.(${eventIds.map((id) => `"${id}"`).join(',')})`;

    const channelName = `unified-feed-${btoa(eventIds.join(',')).slice(0, 60)}`; // stable + short id
    const channel = supabase
      .channel(channelName, { config: { broadcast: { ack: true } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_posts', filter },
        async (payload) => {
          try {
            const postId = (payload.new as any).id;
            const { data, error } = await supabase.rpc('get_feed_item_for_post', {
              p_user: userId || null,
              p_post_id: postId,
            });
            if (!error) {
              const item = Array.isArray(data) ? data[0] : data;
              if (item) prependItem(item as any);
            }
          } catch {
            // best-effort; ignore
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventIds, prependItem, userId]);

  // Meta tags once
  useEffect(() => {
    updateMetaTags(defaultMeta);
  }, []);

  // Clamp currentIndex when items length changes (e.g., after prepend/refresh)
  useEffect(() => {
    setCurrentIndex((i) => Math.min(Math.max(0, i), Math.max(0, items.length - 1)));
  }, [items.length]);

  // ---------- Input handling: keyboard + touch ----------
  const lockRef = useRef(false);
  const lockFor = (ms = 220) => {
    if (lockRef.current) return false;
    lockRef.current = true;
    setTimeout(() => (lockRef.current = false), ms);
    return true;
  };

  // Keyboard navigation + quick actions (no reloads)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Search hotkeys
      const isMac = /mac/i.test(navigator.platform);
      if ((isMac && e.metaKey && e.key.toLowerCase() === 'k') ||
          (!isMac && e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.key === '/') {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && !target?.isContentEditable) {
          e.preventDefault();
          setSearchOpen(true);
        }
        return;
      }

      // Freeze feed nav while comments modal is open
      if (showCommentModal) return;

      if (['ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        if (lockFor()) setCurrentIndex((i) => Math.max(0, i - 1));
      }
      if (['ArrowDown', 'PageDown'].includes(e.key)) {
        e.preventDefault();
        if (lockFor()) setCurrentIndex((i) => Math.min(items.length - 1, i + 1));
      }
      if (e.key === 'Home') {
        e.preventDefault();
        if (lockFor()) setCurrentIndex(0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        if (lockFor()) setCurrentIndex(Math.max(0, items.length - 1));
      }
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSoundToggle();
      }
      if (e.key.toLowerCase() === 'c') {
        const item = items[currentIndex];
        if (item?.item_type === 'post') {
          e.preventDefault();
          handleComment(item.item_id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, currentIndex, showCommentModal]);

  // Touch swipe (vertical) with a small lock to prevent accidental multi-advances
  const touchRef = useRef<{ y: number; t: number } | null>(null);
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      touchRef.current = { y: t.clientY, t: Date.now() };
    };
    const onTouchEnd = (e: TouchEvent) => {
      const start = touchRef.current;
      if (!start) return;
      const dy = (e.changedTouches[0]?.clientY ?? start.y) - start.y;
      const dt = Date.now() - start.t;

      touchRef.current = null;
      if (showCommentModal) return;

      if (dt < 800 && Math.abs(dy) > 50) {
        if (!lockFor()) return;
        if (dy < 0) setCurrentIndex((i) => Math.min(items.length - 1, i + 1));
        else setCurrentIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart as any);
      window.removeEventListener('touchend', onTouchEnd as any);
    };
  }, [items.length, showCommentModal]);

  // ---------- Progressive fetching ----------
  useEffect(() => {
    // start fetching next items a bit early
    if (!loading && hasMore && currentIndex >= items.length - 3) {
      loadMore().catch(() => {});
    }
  }, [currentIndex, items.length, hasMore, loadMore, loading]);

  // ---------- Media control ----------
  // Autoplay current post's video, pause/quiet others; mute all when comment modal is open
  useEffect(() => {
    requestAnimationFrame(() => {
      items.forEach((item, idx) => {
        const root = document.querySelector(`[data-feed-index="${idx}"]`);
        const video = root?.querySelector('video') as HTMLVideoElement | null;
        if (!video) return;

        if (showCommentModal) {
          try { video.pause(); } catch {}
          video.muted = true;
          return;
        }

        if (idx === currentIndex && item.item_type === 'post') {
          video.muted = !soundEnabled;
          if (video.readyState >= 2) {
            video.currentTime = 0;
            video.play().catch(() => {
              // If autoplay blocked, try muted
              video.muted = true;
              video.play().catch(() => {});
            });
          } else {
            const onCanPlay = () => {
              video.currentTime = 0;
              video.play().catch(() => {});
              video.removeEventListener('canplay', onCanPlay);
            };
            video.addEventListener('canplay', onCanPlay);
          }
        } else {
          try { video.pause(); } catch {}
        }
      });
    });
  }, [currentIndex, soundEnabled, items, showCommentModal]);

  // Prevent multiple like calls
  const likingPostsRef = useRef<Set<string>>(new Set());

  // ---------- Actions ----------
  const handleLike = useCallback(
    withAuth(async (postId: string, event?: React.MouseEvent) => {
      console.log('handleLike called for post:', postId);
      
      // Prevent event bubbling
      event?.preventDefault();
      event?.stopPropagation();
      
      // Prevent multiple simultaneous calls for the same post
      if (likingPostsRef.current.has(postId)) {
        console.log('Like already in progress for post:', postId);
        return;
      }
      
      console.log('Adding like lock for post:', postId);
      likingPostsRef.current.add(postId);

      try {
        console.log('Calling reactions-toggle for post:', postId);
        const { data, error } = await supabase.functions.invoke('reactions-toggle', {
          body: { post_id: postId, kind: 'like' },
        });
        if (error) throw error;
        
        console.log('reactions-toggle response:', data);
        
        // Set exact count and state from server response
        if (data) {
          bumpPostLikeCount(postId, data.like_count, data.liked);
        }
        
        toast({ 
          title: data?.liked ? '❤️ Liked!' : '💔 Unliked!', 
          description: data?.liked ? 'Your reaction has been added.' : 'Your reaction has been removed.',
          duration: 2000
        });
      } catch (err) {
        console.error('Like error:', err);
        toast({ title: 'Error', description: 'Failed to like post', variant: 'destructive' });
      } finally {
        // Always remove from processing set
        console.log('Removing like lock for post:', postId);
        likingPostsRef.current.delete(postId);
      }
    }, 'Please sign in to like posts'),
    [withAuth, bumpPostLikeCount]
  );

  const handleComment = useCallback(
    withAuth((postId: string, playbackId?: string) => {
      setCommentPostId(postId);
      setCommentMediaPlaybackId(playbackId);
      setShowCommentModal(true);

      // Soft pause/mute current video's audio for UX
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLVideoElement>(`[data-feed-index="${currentIndex}"] video`);
        if (el) {
          try { el.pause(); } catch {}
          el.muted = true;
        }
      });
    }, 'Please sign in to comment'),
    [withAuth, currentIndex]
  );

  const handleShare = useCallback((_postId: string) => {
    setShowShareModal(true);
  }, []);

  const handleAuthorClick = useCallback(
    (authorId: string) => {
      navigate(`/u/${authorId}`);
    },
    [navigate]
  );

  const handleEventClick = useCallback(
    (eventId: string) => {
      onEventSelect(eventId);
      navigate(`/event/${eventId}`);
    },
    [onEventSelect, navigate]
  );

  const handleOpenTickets = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    setShowTicketModal(true);
  }, []);

  const goTo = useCallback(
    (i: number) => setCurrentIndex(Math.max(0, Math.min(items.length - 1, i))),
    [items.length]
  );

  const handleSoundToggle = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      // Mute all first
      document.querySelectorAll<HTMLVideoElement>('video').forEach((v) => (v.muted = true));
      // Unmute current if enabling
      if (next) {
        const el = document.querySelector<HTMLVideoElement>(`[data-feed-index="${currentIndex}"] video`);
        if (el) el.muted = false;
      }
      return next;
    });
  }, [currentIndex]);

  // Search navigation handlers (no reloads)
  const goToEventFromSearch = useCallback(
    (eventId: string) => {
      onEventSelect(eventId);
      const eventIndex = items.findIndex((item) => item.item_type === 'event' && item.item_id === eventId);
      if (eventIndex !== -1) {
        setCurrentIndex(eventIndex);
      } else {
        navigate(`/event/${eventId}`);
      }
    },
    [onEventSelect, items, navigate]
  );

  const goToPostFromSearch = useCallback(
    (eventId: string, postId: string) => {
      const postIndex = items.findIndex((item) => item.item_type === 'post' && item.item_id === postId);
      if (postIndex !== -1) {
        setCurrentIndex(postIndex);
      } else {
        // fall back to event page if post not in feed yet
        onEventSelect(eventId);
        navigate(`/event/${eventId}`);
      }
    },
    [items, onEventSelect, navigate]
  );

  // ---------- Derived ----------
  const currentItem = items[Math.max(0, Math.min(currentIndex, items.length - 1))];

  // Preload next/prev images (best-effort, no UI reflow)
  useEffect(() => {
    const ids = [currentIndex - 1, currentIndex + 1].filter((i) => i >= 0 && i < items.length);
    ids.forEach((i) => {
      const it = items[i];
      let url: string | undefined;
      if (it.item_type === 'event') {
        url = it.event_cover_image;
      } else {
        const mediaUrl = it.media_urls?.[0];
        if (mediaUrl && !mediaUrl.endsWith('.m3u8')) {
          // Convert mux: URLs to poster URLs for preloading
          url = mediaUrl.startsWith('mux:') ? muxToPoster(mediaUrl) : mediaUrl;
        }
      }
      if (url) {
        const img = new Image();
        img.src = url;
      }
    });
  }, [currentIndex, items]);

  // Get next poster URL for preloading
  const nextPosterUrl = useMemo(() => {
    const nextItem = items[currentIndex + 1];
    if (nextItem?.item_type === 'event' && nextItem.event_cover_image) {
      return nextItem.event_cover_image;
    }
    if (nextItem?.item_type === 'post' && nextItem.media_urls?.[0]) {
      const mediaUrl = nextItem.media_urls[0];
      return mediaUrl.startsWith('mux:') ? muxToPoster(mediaUrl) : mediaUrl;
    }
    return undefined;
  }, [items, currentIndex]);

  // ---------- Empty / Loading ----------
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
        <Button onClick={() => refresh()} className="mt-4">Try Again</Button>
      </div>
    );
  }

  // ---------- UI ----------
  return (
    <div
      className="feed-page h-screen relative overflow-hidden bg-black smooth-feed-scroll"
      style={{ touchAction: 'pan-y' }}
    >
      <PreconnectMux />
      <WarmHlsOnIdle />
      <PreloadNextPoster url={nextPosterUrl} />
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
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Feed Items */}
      <div
        className="h-full w-full relative transition-transform duration-500 ease-out will-change-transform"
        style={{
          transform: `translateY(-${currentIndex * 100}%)`,
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
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
                onVideoToggle={() => {}}
                isVideoPlaying={i === currentIndex}
              />
            ) : (
              <UserPostCard
                item={item}
                onLike={(postId, event) => handleLike(postId, event)}
                onComment={withAuth((postId /*, playbackId?*/) => handleComment(postId /*, playbackId*/), 'Please sign in to comment')}
                onShare={(postId) => handleShare(postId)}
                onEventClick={handleEventClick}
                onAuthorClick={handleAuthorClick}
                onCreatePost={() => requireAuth(() => onCreatePost(), 'Please sign in to create posts')}
                onReport={() => {}}
                onSoundToggle={handleSoundToggle}
                onOpenTickets={handleOpenTickets}
                soundEnabled={soundEnabled}
                onVideoToggle={() => {}}
                isVideoPlaying={i === currentIndex}
              />
            )}
          </div>
        ))}
      </div>

      {/* Navigation controls */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10 pointer-events-none">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => lockFor() && setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0 || showCommentModal}
            className="p-2 rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/60 transition disabled:opacity-50 pointer-events-auto"
            aria-label="Previous item"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center gap-1 max-h-32 overflow-y-auto pointer-events-auto">
            {items.slice(Math.max(0, currentIndex - 3), currentIndex + 4).map((item, i) => {
              const actualIndex = Math.max(0, currentIndex - 3) + i;
              const active = actualIndex === currentIndex;
              return (
                <button
                  key={`${item.item_type}:${item.item_id}`}
                  aria-label={`Go to ${item.item_type} ${actualIndex + 1}`}
                  onClick={() => lockFor() && goTo(actualIndex)}
                  disabled={showCommentModal}
                  className={`w-1 h-6 rounded-full transition-all duration-200 ${
                    active ? 'bg-white shadow-lg' : 'bg-white/40 hover:bg-white/70'
                  } ${showCommentModal ? 'opacity-50' : ''}`}
                />
              );
            })}
          </div>

          <button
            onClick={() => lockFor() && setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={currentIndex === items.length - 1 || showCommentModal}
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
        event={
          selectedEventId
            ? (() => {
                const feedItem = items.find(
                  (it) => it.item_type === 'event' && it.item_id === selectedEventId
                ) as Extract<typeof items[0], { item_type: 'event' }> | undefined;

                return feedItem
                  ? {
                      id: feedItem.event_id,
                      title: feedItem.event_title,
                      start_at: feedItem.event_starts_at,
                      venue: (feedItem as any).event_location ?? undefined,
                      description: (feedItem as any).event_description ?? undefined,
                    }
                  : null;
              })()
            : null
        }
        onSuccess={() => {
          setShowTicketModal(false);
          setSelectedEventId(null);
        }}
      />

      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        payload={
          currentItem
            ? {
                title: currentItem.event_title,
                text: `Check out this event: ${currentItem.event_title}`,
                url: `${window.location.origin}/e/${currentItem.event_id}`,
              }
            : null
        }
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
            setCommentMediaPlaybackId(undefined);
            // Restore audio state softly
            requestAnimationFrame(() => {
              const el = document.querySelector<HTMLVideoElement>(`[data-feed-index="${currentIndex}"] video`);
              if (el) el.muted = !soundEnabled;
            });
          }}
          eventId={currentItem.event_id}
          eventTitle={currentItem.event_title}
          postId={commentPostId}
          mediaPlaybackId={commentMediaPlaybackId}
          onCommentCountChange={(postId, newCount) => {
            console.log('🔥 Index: Updating comment count for post', { postId, newCount });
            // LOCAL IN-PLACE UPDATE — no refresh, no reorder
            bumpPostCommentCount(postId, newCount);
          }}
        />
      )}

      <SearchPalette
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onGoToEvent={goToEventFromSearch}
        onGoToPost={goToPostFromSearch}
        categories={[
          'Music',
          'Sports',
          'Tech',
          'Food',
          'Arts',
          'Business & Professional',
          'Community',
          'Other',
        ]}
      />
    </div>
  );
}
