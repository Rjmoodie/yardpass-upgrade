import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnifiedFeedInfinite } from '@/hooks/useUnifiedFeedInfinite';
import { useCampaignBoosts } from '@/hooks/useCampaignBoosts';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';
import { useShare } from '@/hooks/useShare';
import { useToast } from '@/hooks/use-toast';
import { FeedFilter } from '@/components/FeedFilter';
import CommentModal from '@/components/CommentModal';
import { PostCreatorModal } from '@/components/PostCreatorModal';
import { EventTicketModal } from '@/components/EventTicketModal';
import { EventCardNewDesign } from '@/components/feed/EventCardNewDesign';
import { UserPostCardNewDesign } from '@/components/feed/UserPostCardNewDesign';
import { TopFilters } from '@/components/feed/TopFilters';
import { FloatingActions } from '@/components/feed/FloatingActions';
import { BrandedSpinner } from '@/components/BrandedSpinner';
import { isVideoUrl } from '@/utils/mux';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';

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

const isVideoPost = (item: FeedItem) =>
  item.item_type === 'post' &&
  Array.isArray(item.media_urls) &&
  item.media_urls.some((url) => isVideoUrl(url));

export default function FeedPageNewDesign() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { requireAuth } = useAuthGuard();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
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
  const { applyOptimisticLike, applyEngagementDelta } = useOptimisticReactions();

  const allFeedItems = useMemo(() => {
    const items = data?.pages.flatMap((p) => p.items) ?? [];
    console.log('🎯 Feed items loaded:', {
      total: items.length,
      events: items.filter(i => i.item_type === 'event').length,
      posts: items.filter(i => i.item_type === 'post').length,
      sample: items.slice(0, 3).map(i => ({ type: i.item_type, id: i.item_id }))
    });
    return items;
  }, [data]);
  const activeLocation = filters.locations[0] || 'Near Me';
  const activeDate = filters.dates[0] || 'Anytime';

  const registerInteraction = useCallback(() => {
    if (!autoplayReady) setAutoplayReady(true);
  }, [autoplayReady]);

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

  const handleLike = useCallback((item: FeedItem) => {
    if (item.item_type !== 'post') return;
    applyOptimisticLike(item.item_id);
    registerInteraction();
  }, [applyOptimisticLike, registerInteraction]);

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
      { url, title: item.item_type === 'event' ? item.event_title : item.content_text, text: item.content_text },
      () => toast({ title: 'Link copied!', description: 'Share link copied to clipboard.' })
    );
    registerInteraction();
  }, [share, toast, registerInteraction]);

  const handleEventClick = useCallback((eventId: string) => {
    navigate(`/e/${eventId}`);
    registerInteraction();
  }, [navigate, registerInteraction]);

  const handleOpenTickets = useCallback((eventId: string, item?: any) => {
    if (item && item.item_type === 'event') {
      setTicketModalEvent({
        id: item.event_id,
        title: item.event_title || 'Event',
        start_at: item.event_start_at || '',
        venue: item.event_venue || undefined,
        address: item.event_address || undefined,
        description: item.event_description || undefined,
      });
      setTicketModalOpen(true);
    }
    registerInteraction();
  }, [registerInteraction]);

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
        onLocationClick={() => setFiltersOpen(true)}
        onDateClick={() => setFiltersOpen(true)}
        onFiltersClick={() => setFiltersOpen(true)}
      />

      {/* Floating Actions */}
      <FloatingActions
        isMuted={!globalSoundEnabled}
        onMuteToggle={() => setGlobalSoundEnabled(!globalSoundEnabled)}
        onCreatePost={handleCreatePost}
        onOpenMessages={() => navigate('/messages-new')}
      />

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
                  onAuthorClick={() => item.author_id && navigate(`/u/${item.author_id}`)}
                  onReport={handleReport}
                  soundEnabled={globalSoundEnabled}
                  isVideoPlaying={isVideoActive}
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

        {allFeedItems.length === 0 && (
          <div className="flex h-[60vh] items-center justify-center px-4">
            <div className="max-w-md text-center">
              <h3 className="mb-3 text-xl font-bold text-white">Your feed is empty</h3>
              <p className="mb-6 text-sm text-white/60">
                Follow organizers and explore events to see content here
              </p>
              <button 
                onClick={() => navigate('/search')}
                className="rounded-full bg-[#FF8C00] px-6 py-3 text-sm font-semibold text-white"
              >
                Explore Events
              </button>
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
          isOpen={showCommentModal}
          onClose={() => setShowCommentModal(false)}
          eventId={commentContext.eventId}
          eventTitle={commentContext.eventTitle}
          postId={commentContext.postId}
          onCommentCountChange={(postId, newCount) => {
            applyEngagementDelta(postId, { mode: 'absolute', comment_count: newCount });
          }}
        />
      )}

      <EventTicketModal
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

