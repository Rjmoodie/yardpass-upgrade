import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnifiedFeedInfinite } from '@/hooks/useUnifiedFeedInfinite';
import { useCampaignBoosts } from '@/hooks/useCampaignBoosts';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';
import { useShare } from '@/hooks/useShare';
import { useToast } from '@/hooks/use-toast';
import { useImpressionTracker } from '@/hooks/useImpressionTracker';
import { supabase } from '@/integrations/supabase/client';
import { FeedFilter } from '@/components/FeedFilter';
import CommentModal from '@/components/CommentModal';
import { PostCreatorModal } from '@/components/PostCreatorModal';
import EventCheckoutSheet from '@/components/EventCheckoutSheet';
import { EventCardNewDesign } from '@/components/feed/EventCardNewDesign';
import { UserPostCardNewDesign } from '@/components/feed/UserPostCardNewDesign';
import { TopFilters } from '@/components/feed/TopFilters';
import { FloatingActions } from '@/components/feed/FloatingActions';
import { ProfileCompletionModal } from '@/components/auth/ProfileCompletionModal';
import { BrandedSpinner } from '@/components/BrandedSpinner';
import { isVideoUrl } from '@/utils/mux';
import { logger } from '@/utils/logger';
import { startTracking, endTracking } from '@/utils/performanceTracking';
import { FeedLoadingSkeleton } from '@/components/feed/FeedCardSkeleton';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';
import { Volume2, VolumeX } from 'lucide-react';

type FeedFilters = {
  dates: string[];
  locations: string[];
  categories: string[];
  searchRadius: number;
};

const DEFAULT_FILTERS: FeedFilters = {
  dates: [],
  locations: ['Near Me'],
  categories: [],
  searchRadius: 25,
};

const createDefaultFilters = (): FeedFilters => ({
  dates: [...DEFAULT_FILTERS.dates],
  locations: [...DEFAULT_FILTERS.locations],
  categories: [...DEFAULT_FILTERS.categories],
  searchRadius: DEFAULT_FILTERS.searchRadius,
});

const isVideoPost = (item: FeedItem) =>
  item.item_type === 'post' &&
  Array.isArray(item.media_urls) &&
  item.media_urls.some((url) => isVideoUrl(url));

export default function FeedPageNewDesign() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { requireAuth, isAuthenticated } = useAuthGuard();
  const { user, profile, updateProfileOptimistic } = useAuth();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const [filters, setFilters] = useState<FeedFilters>(() => createDefaultFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [globalSoundEnabled, setGlobalSoundEnabled] = useState(false);
  const [pausedVideos, setPausedVideos] = useState<Record<string, boolean>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  // ✅ OPTIMIZATION: Start with autoplay ready if user has interacted with page before
  const [autoplayReady, setAutoplayReady] = useState(true);
  const [commentContext, setCommentContext] = useState<any>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketModalEvent, setTicketModalEvent] = useState<any>(null);
  const [soundToastVisible, setSoundToastVisible] = useState(false);
  const [lastGlobalSoundState, setLastGlobalSoundState] = useState(globalSoundEnabled);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);

  const {
    data,
    status,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useUnifiedFeedInfinite({
    locations: filters.locations,
    categories: filters.categories,
    dates: filters.dates,
    searchRadius: filters.searchRadius,
  });

  // Debug: Log active filters (dev only)
  useEffect(() => {
    logger.debug('🔍 [FeedPage] Active filters:', {
      locations: filters.locations,
      categories: filters.categories,
      dates: filters.dates,
      searchRadius: filters.searchRadius
    });
  }, [filters]);

  const { data: boosts } = useCampaignBoosts({ placement: 'feed', enabled: true, userId: user?.id });
  const { sharePost, shareEvent, copyLink } = useShare();
  const { toggleLike: toggleLikeOptimistic, getOptimisticData, getOptimisticCommentData } = useOptimisticReactions();
  const soundToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved posts for the current user
  useEffect(() => {
    const loadSavedPosts = async () => {
      if (!user) {
        setSavedPostIds(new Set());
        return;
      }

      try {
        // Use user_saved_posts table
        const { data } = await supabase
          .from('user_saved_posts')
          .select('post_id')
          .eq('user_id', user.id);

        if (data) {
          setSavedPostIds(new Set(data.map(item => item.post_id)));
        }
      } catch (error) {
        console.error('Error loading saved posts:', error);
        // Silently fail if table doesn't exist
      }
    };

    loadSavedPosts();
  }, [user]);

  const allFeedItems = useMemo(() => {
    const items = data?.pages.flatMap((p) => p.items) ?? [];
    logger.debug('🎯 Feed items loaded:', {
      total: items.length,
      events: items.filter(i => i.item_type === 'event').length,
      posts: items.filter(i => i.item_type === 'post').length,
      promoted: items.filter(i => i.isPromoted || i.promotion).length
    });
    return items;
  }, [data]);

  // 🎯 PERF-001: Track feed load performance
  const trackingStartedRef = useRef(false);
  
  useEffect(() => {
    if (!trackingStartedRef.current) {
      startTracking('feed_load');
      trackingStartedRef.current = true;
    }
  }, []); // Start tracking on mount

  useEffect(() => {
    // End tracking when we have data and it's not loading
    if (status === 'success' && allFeedItems.length > 0 && !isFetchingNextPage && trackingStartedRef.current) {
      endTracking('feed_load', {
        itemCount: allFeedItems.length,
        eventCount: allFeedItems.filter(i => i.item_type === 'event').length,
        postCount: allFeedItems.filter(i => i.item_type === 'post').length,
        promotedCount: allFeedItems.filter(i => i.isPromoted || i.promotion).length,
        hasFilters: filters.locations.length > 1 || filters.categories.length > 0 || filters.dates.length > 0
      });
      trackingStartedRef.current = false; // Reset for next load
    }
  }, [status, allFeedItems.length, isFetchingNextPage, filters]);

  // Ad impression tracking
  useImpressionTracker({
    items: allFeedItems,
    currentIndex: activeIndex,
    userId: user?.id ?? null,
    isSuspended: false, // Can add logic here to suspend tracking when modals are open
  });

  const activeLocation = filters.locations[0] || 'Near Me';
  const activeDate = filters.dates[0] || 'Anytime';

  const registerInteraction = useCallback(() => {
    if (!autoplayReady) setAutoplayReady(true);
  }, [autoplayReady]);

  const hasActiveFilters = useMemo(() => {
    const locationsChanged =
      filters.locations.length !== DEFAULT_FILTERS.locations.length ||
      filters.locations.some((location, index) => DEFAULT_FILTERS.locations[index] !== location);

    return (
      filters.dates.length > 0 ||
      filters.categories.length > 0 ||
      filters.searchRadius !== DEFAULT_FILTERS.searchRadius ||
      locationsChanged
    );
  }, [filters]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }
      },
      { rootMargin: '400px' }
    );
    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);
    return () => {
      if (sentinel) observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Track which item is currently in view to control video playback
  // ✅ OPTIMIZED: More aggressive intersection threshold for faster video activation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // ✅ OPTIMIZATION: Process entries in order for faster response
        const intersectingEntries = entries.filter(e => e.isIntersecting);
        
        intersectingEntries.forEach((entry) => {
          const index = Number(entry.target.getAttribute('data-index'));
          if (!isNaN(index)) {
            // ✅ OPTIMIZATION: Use requestAnimationFrame for smoother state updates
            requestAnimationFrame(() => {
              setActiveIndex(index);
            });
          }
        });
      },
      { 
        root: scrollRef.current,
        threshold: 0.25, // ✅ OPTIMIZED: Start loading at 25% visible (was 50%)
        rootMargin: '200px 0px', // ✅ OPTIMIZED: Preload videos 200px before they enter viewport
      }
    );

    const items = itemRefs.current;
    items.forEach((item) => {
      if (item) observer.observe(item);
    });

    return () => {
      observer.disconnect();
    };
  }, [allFeedItems.length]); // Re-run when feed items change

  const handleLike = useCallback(async (item: FeedItem) => {
    if (item.item_type !== 'post') return;
    if (!isAuthenticated) {
      requireAuth(() => {}, 'Please sign in to like posts');
      return;
    }
    
    // ✅ USERNAME REQUIREMENT: Check before API call
    if (!profile?.username) {
      setShowProfileCompletion(true);
      return;
    }
    
    // Get the current optimistic state or fallback to server data
    const optimisticData = getOptimisticData(
      item.item_id,
      { isLiked: item.metrics?.viewer_has_liked || false, likeCount: item.metrics?.likes || 0 }
    );
    
    const result = await toggleLikeOptimistic(item.item_id, optimisticData.isLiked, optimisticData.likeCount);
    
    // Don't refetch immediately - optimistic update handles the UI
    // Only refetch on error to correct the state
    if (!result.ok) {
      refetch();
    }
    
    registerInteraction();
  }, [toggleLikeOptimistic, isAuthenticated, requireAuth, registerInteraction, refetch, getOptimisticData, profile]);

  const handleComment = useCallback((item: FeedItem) => {
    if (item.item_type !== 'post') return;
    
    // ✅ USERNAME REQUIREMENT: Check before opening comment modal
    if (isAuthenticated && !profile?.username) {
      setShowProfileCompletion(true);
      return;
    }
    
    logger.debug('💬 [FeedPage] Comment clicked for post:', item.item_id);
    
    // Clear old context first to ensure clean state
    setCommentContext(null);
    setShowCommentModal(false);
    
    // Set new context after a brief delay to ensure cleanup
    setTimeout(() => {
      setCommentContext({
        postId: item.item_id,
        eventId: item.event_id || '',
        eventTitle: item.event_title || 'Event',
      });
      setShowCommentModal(true);
    }, 50);
    
    registerInteraction();
  }, [registerInteraction]);

  const handleSharePost = useCallback(async (item: FeedItem) => {
    if (item.item_type === 'event') {
      await shareEvent(item.event_id || '', item.event_title || 'Event');
    } else if (item.item_type === 'post') {
      await sharePost(item.item_id, item.event_title || 'Event', item.content);
    }
    registerInteraction();
  }, [sharePost, shareEvent, registerInteraction]);

  const handleSave = useCallback(async (item: FeedItem) => {
    if (item.item_type !== 'post') return;
    if (!isAuthenticated) {
      requireAuth(() => {}, 'Please sign in to save posts');
      return;
    }

    // ✅ OPTIMISTIC UPDATE: Update UI immediately
    const wasSaved = savedPostIds.has(item.item_id);
    const optimisticState = !wasSaved;
    
    // Update UI instantly
    setSavedPostIds(prev => {
      const next = new Set(prev);
      if (optimisticState) {
        next.add(item.item_id);
      } else {
        next.delete(item.item_id);
      }
      return next;
    });
    
    // Show instant feedback
    toast({ 
      title: optimisticState ? 'Saved!' : 'Removed', 
      description: optimisticState 
        ? 'Post saved to your collection' 
        : 'Post removed from saved',
      duration: 2000
    });

    try {
      // ✅ Use toggle RPC function (single call, faster)
      const { data: isSaved, error } = await supabase
        .rpc('toggle_saved_post', { p_post_id: item.item_id });

      if (error) throw error;

      // Sync state with server response (in case of race conditions)
      setSavedPostIds(prev => {
        const next = new Set(prev);
        if (isSaved) {
          next.add(item.item_id);
        } else {
          next.delete(item.item_id);
        }
        return next;
      });
    } catch (error) {
      console.error('Error saving post:', error);
      
      // ✅ ROLLBACK: Revert optimistic update on error
      setSavedPostIds(prev => {
        const next = new Set(prev);
        if (wasSaved) {
          next.add(item.item_id);
        } else {
          next.delete(item.item_id);
        }
        return next;
      });
      
      toast({ 
        title: 'Error', 
        description: 'Failed to save post. Please try again.',
        variant: 'destructive',
        duration: 3000
      });
    }
    
    registerInteraction();
  }, [user, isAuthenticated, requireAuth, toast, registerInteraction, savedPostIds]);

  const handleEventClick = useCallback((eventId: string) => {
    navigate(`/e/${eventId}`);
    registerInteraction();
  }, [navigate, registerInteraction]);

  const handleOpenTickets = useCallback((eventId: string, item?: any) => {
    if (item) {
      if (item.item_type === 'event') {
        setTicketModalEvent({
          id: item.event_id,
          title: item.event_title || 'Event',
          start_at: item.event_starts_at || '',  // Fixed: event_starts_at
          startAtISO: item.event_starts_at,
          venue: item.event_venue || undefined,
          address: item.event_location || item.event_address || undefined,
          description: item.event_description || undefined,
        });
        setTicketModalOpen(true);
      } else if (item.item_type === 'post' && item.event_id) {
        // For posts associated with an event
        setTicketModalEvent({
          id: item.event_id,
          title: item.event_title || 'Event',
          start_at: item.event_starts_at || '',
          venue: item.event_location || undefined,
          address: undefined,
          description: undefined,
        });
        setTicketModalOpen(true);
      }
    } else if (eventId) {
      // Fallback: just use eventId if no item provided
      setTicketModalEvent({
        id: eventId,
        title: 'Event',
        start_at: '',
        venue: undefined,
        address: undefined,
        description: undefined,
      });
      setTicketModalOpen(true);
    }
    registerInteraction();
  }, [registerInteraction]);

  const handleToggleGlobalSound = useCallback(() => {
    // ✅ OPTIMIZATION: Use functional update for immediate state change
    setGlobalSoundEnabled((prev) => {
      const next = !prev;
      
      // Immediate visual feedback
      setLastGlobalSoundState(next);
      
      // Show toast with animation
      setSoundToastVisible(true);
      if (soundToastTimeoutRef.current) clearTimeout(soundToastTimeoutRef.current);
      soundToastTimeoutRef.current = setTimeout(() => setSoundToastVisible(false), 2400);
      
      return next;
    });
    
    registerInteraction();
  }, [registerInteraction]);

  const handleClearFilters = useCallback(() => {
    setFilters(createDefaultFilters());
    setFiltersOpen(false);
    toast({ title: 'Filters cleared', description: 'Showing events near you anytime.' });
    registerInteraction();
  }, [registerInteraction, toast, isAuthenticated, profile]);

  const handleCreatePost = useCallback(() => {
    requireAuth(() => {
      // ✅ USERNAME REQUIREMENT: Check before opening post creator
      if (!profile?.username) {
        setShowProfileCompletion(true);
        return;
      }
      setPostCreatorOpen(true);
    }, 'Sign in to create posts');
    registerInteraction();
  }, [requireAuth, registerInteraction, profile]);

  const handleReport = useCallback(() => {
    toast({
      title: 'Reported',
      description: 'Thank you for your report. Our team will review this content.',
    });
  }, [toast]);

  useEffect(() => {
    return () => {
      if (soundToastTimeoutRef.current) {
        clearTimeout(soundToastTimeoutRef.current);
      }
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-lg font-semibold">We couldn't load your feed.</p>
        <button onClick={() => refetch()} className="rounded-full bg-primary px-6 py-3 text-primary-foreground font-semibold">
          Refresh feed
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-black" />
      <div className="pointer-events-none absolute left-1/2 top-[-30%] h-[520px] w-[125%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(circle_at_center,_rgba(120,119,198,0.35)_0%,_rgba(32,31,60,0.05)_55%,_transparent_75%)] blur-3xl" />

      {/* Top Filters */}
      <TopFilters
        location={activeLocation}
        dateFilter={activeDate}
        onLocationClick={() => {
          setFiltersOpen(true);
          registerInteraction();
        }}
        onDateClick={() => {
          setFiltersOpen(true);
          registerInteraction();
        }}
        onFiltersClick={() => {
          setFiltersOpen(true);
          registerInteraction();
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Floating Actions - Hidden when filters are open */}
      {!filtersOpen && (
        <>
          <FloatingActions
        isMuted={!globalSoundEnabled}
        onMuteToggle={handleToggleGlobalSound}
        onCreatePost={handleCreatePost}
        onLike={allFeedItems[activeIndex]?.item_type === 'post' ? () => {
          const item = allFeedItems[activeIndex];
          handleLike(item);
        } : undefined}
        onComment={allFeedItems[activeIndex]?.item_type === 'post' ? () => {
          const item = allFeedItems[activeIndex];
          handleComment(item);
        } : undefined}
        onShare={allFeedItems[activeIndex]?.item_type === 'post' ? () => {
          const item = allFeedItems[activeIndex];
          handleSharePost(item);
        } : undefined}
        onSave={allFeedItems[activeIndex]?.item_type === 'post' ? () => {
          const item = allFeedItems[activeIndex];
          handleSave(item);
        } : undefined}
        likeCount={allFeedItems[activeIndex]?.item_type === 'post' ? 
          getOptimisticData(
            allFeedItems[activeIndex].item_id, 
            { isLiked: allFeedItems[activeIndex].metrics?.viewer_has_liked || false, likeCount: allFeedItems[activeIndex].metrics?.likes || 0 }
          ).likeCount : 0
        }
        commentCount={allFeedItems[activeIndex]?.item_type === 'post' ? 
          getOptimisticCommentData(
            allFeedItems[activeIndex].item_id,
            { commentCount: allFeedItems[activeIndex].metrics?.comments || 0 }
          ).commentCount : 0
        }
        isLiked={allFeedItems[activeIndex]?.item_type === 'post' ? 
          getOptimisticData(
            allFeedItems[activeIndex].item_id,
            { isLiked: allFeedItems[activeIndex].metrics?.viewer_has_liked || false, likeCount: allFeedItems[activeIndex].metrics?.likes || 0 }
          ).isLiked : false
        }
        isSaved={allFeedItems[activeIndex]?.item_type === 'post' ? savedPostIds.has(allFeedItems[activeIndex].item_id) : false}
      />
        </>
      )}

      {soundToastVisible && (
        <div className="fixed left-1/2 top-32 z-40 -translate-x-1/2 sm:top-36 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-xs font-semibold text-foreground shadow-2xl backdrop-blur-md sm:px-5 sm:text-sm">
            {lastGlobalSoundState ? (
              <Volume2 className="h-4 w-4 text-primary animate-in zoom-in duration-200" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground animate-in zoom-in duration-200" />
            )}
            <span className="animate-in fade-in duration-200">
              {lastGlobalSoundState ? 'Sound on for all videos' : 'Muted all videos'}
            </span>
          </div>
        </div>
      )}

      {/* Feed Content - Full Screen TikTok Style */}
      <div 
        ref={scrollRef}
        className="hide-scrollbar relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', scrollSnapStop: 'always' }}
      >
        {allFeedItems.map((item, idx) => {
          const isPost = item.item_type === 'post';
          const paused = pausedVideos[item.item_id];
          const hasVideo = isPost && isVideoPost(item);
          const isVideoActive = isPost && idx === activeIndex && !paused && autoplayReady && hasVideo;
          
          // ✅ OPTIMIZATION: Determine if video should be visible (current, prev, or next)
          // This allows adjacent videos to preload for instant playback
          const isAdjacentVideo = Math.abs(idx - activeIndex) <= 1;
          const shouldRenderVideo = hasVideo && (isVideoActive || isAdjacentVideo);

          return (
            <section
              key={item.item_id}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              data-index={idx}
              className="snap-start snap-always relative h-screen w-full"
            >
              {item.item_type === 'event' ? (
                <EventCardNewDesign
                  item={item}
                  onOpenTickets={(eventId) => handleOpenTickets(eventId, item)}
                  onEventClick={handleEventClick}
                  onCreatePost={handleCreatePost}
                />
              ) : (
                <UserPostCardNewDesign
                  item={item}
                  onLike={() => handleLike(item)}
                  onComment={() => handleComment(item)}
                  onShare={() => handleSharePost(item)}
                  onAuthorClick={() => {
                    // Prefer username over user_id for cleaner URLs
                    const identifier = item.author_username || item.author_id;
                    if (identifier) navigate(`/profile/${identifier}`);
                  }}
                  onReport={handleReport}
                  onDelete={() => refetch()} // ✅ Refresh feed when post deleted
                  soundEnabled={globalSoundEnabled}
                  isVideoPlaying={isVideoActive}
                  onGetTickets={(eventId) => handleOpenTickets(eventId, item)}
                />
              )}
            </section>
          );
        })}

        <div ref={sentinelRef} className="h-32" />
        
        {/* 🎯 PERF-009: Replace spinner with skeleton for next page */}
        {isFetchingNextPage && (
          <div className="py-4">
            <FeedLoadingSkeleton count={2} />
          </div>
        )}

        {/* 🎯 PERF-009: Show skeleton while initial feed loads */}
        {allFeedItems.length === 0 && status === 'pending' && (
          <div className="px-4">
            <FeedLoadingSkeleton count={3} />
          </div>
        )}
        
        {/* Empty state (only show if loaded but no items) */}
        {allFeedItems.length === 0 && status === 'success' && !isFetchingNextPage && (
          <div className="flex h-[60vh] items-center justify-center px-4">
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-muted-foreground">No events found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          </div>
        )}
        
        <div className="h-24" />
      </div>

      <FeedFilter
        isOpen={filtersOpen}
        onToggle={() => setFiltersOpen(!filtersOpen)}
        onFilterChange={setFilters}
        value={filters}
      />

      {commentContext && (
        <CommentModal
          key={`modal-${commentContext.postId}-${commentContext.eventId}`}
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setCommentContext(null); // ✅ Clear context on close
            // Refetch feed to get updated comment counts
            refetch();
          }}
          eventId={commentContext.eventId}
          eventTitle={commentContext.eventTitle}
          postId={commentContext.postId}
          onCommentCountChange={(postId, newCount) => {
            // Comment count will be updated via refetch
            refetch();
          }}
          onRequestUsername={() => {
            // ✅ Seamlessly open username prompt (keeps comment modal open in background)
            setShowProfileCompletion(true);
          }}
        />
      )}

      <EventCheckoutSheet
        event={ticketModalEvent}
        isOpen={ticketModalOpen && !!ticketModalEvent}
        onClose={() => {
          setTicketModalOpen(false);
          setTicketModalEvent(null);
        }}
        onSuccess={() => {
          setTicketModalOpen(false);
          setTicketModalEvent(null);
          navigate('/tickets-new');
        }}
      />

      <PostCreatorModal
        isOpen={postCreatorOpen}
        onClose={() => setPostCreatorOpen(false)}
        onSuccess={() => {
          setPostCreatorOpen(false);
          toast({ title: 'Success', description: 'Your post has been created!' });
          refetch();
        }}
      />

      {/* Profile Completion Modal - Required for guests to engage */}
      <ProfileCompletionModal
        isOpen={showProfileCompletion}
        onClose={() => setShowProfileCompletion(false)}
        onSuccess={async (username) => {
          setShowProfileCompletion(false);

          if (user?.id) {
            // Optimistically update auth context so UI re-renders immediately
            updateProfileOptimistic({ username });

            // Best-effort fetch to ensure consistency (non-blocking)
            supabase
              .from('user_profiles')
              .select('username')
              .eq('user_id', user.id)
              .maybeSingle()
              .then((res) => {
                if (res.data?.username) {
                  updateProfileOptimistic({ username: res.data.username });
                }
              })
              .catch((err) => console.warn('[Feed] Failed to refresh profile username', err));

            // Refresh feed data so cached items show updated username
            refetch();
          }

          toast({
            title: 'Profile complete! 🎉',
            description: `Welcome @${username}! You can now like, comment, and post.`,
          });
        }}
        userId={user?.id || ''}
        displayName={profile?.display_name}
      />
    </div>
  );
}

