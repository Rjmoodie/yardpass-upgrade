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
import EventCheckoutSheet from '@/components/EventCheckoutSheet';
import { isVideoUrl } from '@/utils/mux';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';
import { FeedCard } from '../../../New design/FeedCard';
import { TopFilters } from '../../../New design/TopFilters';
import { FloatingActions } from '../../../New design/FloatingActions';
import { BrandedSpinner } from '@/components/BrandedSpinner';

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

const PROMOTED_INTERVAL = 4;

const isVideoPost = (item: FeedItem) =>
  item.item_type === 'post' &&
  Array.isArray(item.media_urls) &&
  item.media_urls.some((url) => isVideoUrl(url));

export default function FeedPageComplete() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { requireAuth } = useAuthGuard();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [globalSoundEnabled, setGlobalSoundEnabled] = useState(false);
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

  const { data: boosts } = useCampaignBoosts();
  const { share } = useShare();
  const { applyOptimisticLike, applyEngagementDelta } = useOptimisticReactions();

  const allFeedItems = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const activeLocation = filters.locations[0] || 'Near Me';

  // Transform FeedItem to New design format
  const transformToNewDesignFormat = (item: FeedItem) => {
    if (item.item_type === 'event') {
      return {
        id: item.event_id,
        title: item.event_title || 'Event',
        image: item.event_cover_image || '',
        date: item.event_start_at ? new Date(item.event_start_at).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        }) : 'TBA',
        location: `${item.event_venue || 'Venue TBA'}${item.event_address ? ', ' + item.event_address : ''}`,
        description: item.event_description || 'No description available'
      };
    }
    // For posts, we'll use existing UserPostCard logic
    return null;
  };

  const handleOpenTickets = useCallback((eventId: string, item?: any) => {
    if (item && item.item_type === 'event') {
      setTicketModalEvent({
        id: item.event_id,
        title: item.event_title || 'Event',
        start_at: item.event_starts_at || '',  // Fixed: event_starts_at not event_start_at
        startAtISO: item.event_starts_at,
        venue: item.event_venue || undefined,
        address: item.event_location || undefined,  // Also using event_location for address
        description: item.event_description || undefined,
      });
      setTicketModalOpen(true);
    }
  }, []);

  const handleCreatePost = useCallback(() => {
    requireAuth(() => {
      setPostCreatorOpen(true);
    }, 'Sign in to create posts');
  }, [requireAuth]);

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

  if (status === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-border/10 border-t-primary" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 text-foreground">
        <p className="text-lg font-semibold">We couldn't load your feed.</p>
        <button onClick={() => refetch()} className="rounded-full bg-primary px-6 py-3 text-foreground">
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
        dateFilter={filters.dates[0] || 'Anytime'}
        onLocationClick={() => setFiltersOpen(true)}
        onDateClick={() => setFiltersOpen(true)}
        onFiltersClick={() => setFiltersOpen(true)}
      />

      {/* Floating Actions - Hidden when filters are open */}
      {!filtersOpen && (
        <FloatingActions
          isMuted={!globalSoundEnabled}
          onMuteToggle={() => setGlobalSoundEnabled(!globalSoundEnabled)}
          onCreatePost={handleCreatePost}
          onOpenMessages={() => navigate('/messages-new')}
        />
      )}

      {/* Feed Content */}
      <div 
        ref={scrollRef}
        className="hide-scrollbar relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', scrollSnapStop: 'always' }}
      >
        <div className="h-20" />

        {allFeedItems.map((item) => {
          const transformedEvent = item.item_type === 'event' ? transformToNewDesignFormat(item) : null;
          
          if (transformedEvent) {
            return (
              <section
                key={item.item_id}
                className="snap-start snap-always h-dvh flex items-center"
              >
                <div className="mx-auto flex h-full w-full items-stretch">
                  <FeedCard event={transformedEvent} />
                </div>
              </section>
            );
          }
          
          // For posts, we'll create a similar card
          return null;
        })}

        <div ref={sentinelRef} className="h-32" />
        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <BrandedSpinner size="sm" text="Loading more" />
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

