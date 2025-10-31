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
import { BrandedSpinner } from '@/components/BrandedSpinner';
import { isVideoUrl } from '@/utils/mux';
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
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const [filters, setFilters] = useState<FeedFilters>(() => createDefaultFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [globalSoundEnabled, setGlobalSoundEnabled] = useState(false);
  const [pausedVideos, setPausedVideos] = useState<Record<string, boolean>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplayReady, setAutoplayReady] = useState(false);
  const [commentContext, setCommentContext] = useState<any>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketModalEvent, setTicketModalEvent] = useState<any>(null);
  const [soundToastVisible, setSoundToastVisible] = useState(false);
  const [lastGlobalSoundState, setLastGlobalSoundState] = useState(globalSoundEnabled);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(new Set());

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

  const { data: boosts } = useCampaignBoosts({ placement: 'feed', enabled: true, userId: user?.id });
  const { share } = useShare();
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
    console.log('🎯 Feed items loaded:', {
      total: items.length,
      events: items.filter(i => i.item_type === 'event').length,
      posts: items.filter(i => i.item_type === 'post').length,
      promoted: items.filter(i => i.isPromoted || i.promotion).length,
      promotedAds: items.filter(i => i.isPromoted || i.promotion).map((ad, idx) => ({
        feedIndex: items.indexOf(ad),
        eventId: ad.event_id,
        isPromoted: ad.isPromoted,
        hasPromotion: !!ad.promotion,
        campaignId: ad.promotion?.campaignId,
        creativeId: ad.promotion?.creativeId,
        placement: ad.promotion?.placement,
        ctaLabel: ad.promotion?.ctaLabel,
      })),
      postsWithCounts: items.filter(i => i.item_type === 'post').map(i => ({
        id: i.item_id,
        likes: i.metrics?.likes || 0,
        comments: i.metrics?.comments || 0,
        viewer_has_liked: i.metrics?.viewer_has_liked || false
      })),
      sample: items.slice(0, 3).map(i => ({ type: i.item_type, id: i.item_id }))
    });
    return items;
  }, [data]);

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
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index)) {
              setActiveIndex(index);
            }
          }
        });
      },
      { 
        root: scrollRef.current,
        threshold: 0.5, // Item is considered "active" when 50% visible
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
  }, [toggleLikeOptimistic, isAuthenticated, requireAuth, registerInteraction, refetch, getOptimisticData]);

  const handleComment = useCallback((item: FeedItem) => {
    if (item.item_type !== 'post') return;
    setCommentContext({
      postId: item.item_id,
      eventId: item.event_id || '',
      eventTitle: item.event_title || 'Event',
    });
    setShowCommentModal(true);
    registerInteraction();
  }, [registerInteraction]);

  const handleSharePost = useCallback((item: FeedItem) => {
    const url = item.item_type === 'event' 
      ? `${window.location.origin}/e/${item.event_id}`
      : `${window.location.origin}/post/${item.item_id}`;
    share(
      { url, title: item.item_type === 'event' ? item.event_title : item.content || '', text: item.content || '' },
      () => toast({ title: 'Link copied!', description: 'Share link copied to clipboard.' })
    );
    registerInteraction();
  }, [share, toast, registerInteraction]);

  const handleSave = useCallback(async (item: FeedItem) => {
    if (item.item_type !== 'post') return;
    if (!isAuthenticated) {
      requireAuth(() => {}, 'Please sign in to save posts');
      return;
    }

    try {
      // Check if already saved
      const { data: existing } = await supabase
        .from('user_saved_posts')
        .select('id')
        .eq('user_id', user?.id)
        .eq('post_id', item.item_id)
        .maybeSingle();

      if (existing) {
        // Unsave
        await supabase
          .from('user_saved_posts')
          .delete()
          .eq('id', existing.id);
        
        setSavedPostIds(prev => {
          const next = new Set(prev);
          next.delete(item.item_id);
          return next;
        });
        
        toast({ title: 'Removed from saved', description: 'Post removed from your saved collection' });
      } else {
        // Save
        await supabase
          .from('user_saved_posts')
          .insert({
            user_id: user?.id,
            post_id: item.item_id,
            event_id: item.event_id
          });
        
        setSavedPostIds(prev => new Set([...prev, item.item_id]));
        
        toast({ title: 'Saved!', description: 'Post saved to your collection' });
      }
    } catch (error) {
      console.error('Error saving post:', error);
      toast({ title: 'Save feature coming soon', description: 'This feature will be available soon', variant: 'default' });
    }
    registerInteraction();
  }, [user, isAuthenticated, requireAuth, toast, registerInteraction]);

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
    setGlobalSoundEnabled((prev) => {
      const next = !prev;
      setLastGlobalSoundState(next);
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
  }, [registerInteraction, toast]);

  const handleCreatePost = useCallback(() => {
    requireAuth(() => {
      setPostCreatorOpen(true);
    }, 'Sign in to create posts');
    registerInteraction();
  }, [requireAuth, registerInteraction]);

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
      <div className="flex h-dvh items-center justify-center bg-black">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#FF8C00]" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 text-white">
        <p className="text-lg font-semibold">We couldn't load your feed.</p>
        <button onClick={() => refetch()} className="rounded-full bg-[#FF8C00] px-6 py-3 text-white font-semibold">
          Refresh feed
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black text-white">
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
          {(() => {
            const currentItem = allFeedItems[activeIndex];
            const isPost = currentItem?.item_type === 'post';
            const rawLikes = currentItem?.metrics?.likes;
            const rawComments = currentItem?.metrics?.comments;
            
            const optimisticLikes = isPost ? getOptimisticData(
              currentItem.item_id, 
              { isLiked: currentItem.metrics?.viewer_has_liked || false, likeCount: rawLikes || 0 }
            ).likeCount : 0;
            
            const optimisticComments = isPost ? getOptimisticCommentData(
              currentItem.item_id,
              { commentCount: rawComments || 0 }
            ).commentCount : 0;
            
            console.log('🔍 FloatingActions DETAILED Debug:', {
              activeIndex,
              itemType: currentItem?.item_type,
              isPost,
              rawMetrics: currentItem?.metrics,
              rawLikes,
              rawComments,
              optimisticLikes,
              optimisticComments,
              fullItem: currentItem
            });
            
            return null;
          })()}
          <FloatingActions
        isMuted={!globalSoundEnabled}
        onMuteToggle={handleToggleGlobalSound}
        onCreatePost={handleCreatePost}
        onLike={allFeedItems[activeIndex]?.item_type === 'post' ? () => {
          const item = allFeedItems[activeIndex];
          console.log('🎯 FloatingActions Like clicked for post:', item.item_id, 'Current likes:', item.metrics?.likes);
          handleLike(item);
        } : undefined}
        onComment={allFeedItems[activeIndex]?.item_type === 'post' ? () => {
          const item = allFeedItems[activeIndex];
          console.log('💬 FloatingActions Comment clicked for post:', item.item_id, 'Current comments:', item.metrics?.comments);
          handleComment(item);
        } : undefined}
        onShare={allFeedItems[activeIndex]?.item_type === 'post' ? () => {
          const item = allFeedItems[activeIndex];
          console.log('🔗 FloatingActions Share clicked for post:', item.item_id);
          handleSharePost(item);
        } : undefined}
        onSave={allFeedItems[activeIndex]?.item_type === 'post' ? () => {
          const item = allFeedItems[activeIndex];
          console.log('🔖 FloatingActions Save clicked for post:', item.item_id);
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
        <div className="fixed left-1/2 top-32 z-40 -translate-x-1/2 sm:top-36">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-md sm:px-5 sm:text-sm">
            {lastGlobalSoundState ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            <span>{lastGlobalSoundState ? 'Sound on for all videos' : 'Muted all videos'}</span>
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
                  soundEnabled={globalSoundEnabled}
                  isVideoPlaying={isVideoActive}
                  onGetTickets={(eventId) => handleOpenTickets(eventId, item)}
                />
              )}
            </section>
          );
        })}

        <div ref={sentinelRef} className="h-32" />
        
        {isFetchingNextPage && (
          <div className="flex justify-center py-8">
            <BrandedSpinner size="sm" text="Loading more" />
          </div>
        )}

        {allFeedItems.length === 0 && status !== 'loading' && !isFetchingNextPage && (
          <div className="flex h-[60vh] items-center justify-center px-4">
            <BrandedSpinner size="lg" text="Loading your feed" />
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
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            // Refetch feed to get updated comment counts
            refetch();
          }}
          eventId={commentContext.eventId}
          eventTitle={commentContext.eventTitle}
          postId={commentContext.postId}
          onCommentCountChange={(postId, newCount) => {
            // Comment count will be updated via refetch
            console.log('Comment count updated:', postId, newCount);
            refetch();
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
    </div>
  );
}

