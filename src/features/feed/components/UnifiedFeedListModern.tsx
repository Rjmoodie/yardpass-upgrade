import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, MapPin, Clock } from 'lucide-react';
import { BrandedSpinner } from '@/components/BrandedSpinner';
import { useUnifiedFeedInfinite } from '@/hooks/useUnifiedFeedInfinite';
import { useCampaignBoosts, type CampaignBoostRow } from '@/hooks/useCampaignBoosts';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';
import { useShare } from '@/hooks/useShare';
import { useToast } from '@/hooks/use-toast';
import { FeedFilter } from '@/components/FeedFilter';
import { FeedGestures } from '@/components/FeedGestures';
import { FeedKeymap } from '@/components/FeedKeymap';
import { EventCardModern } from '@/components/EventCardModern';
import { UserPostCardModern } from '@/components/UserPostCardModern';
import { FloatingActions } from '@/components/feed/FloatingActions';
import { TopFilters } from '@/components/feed/TopFilters';
import CommentModal from '@/components/CommentModal';
import { PostCreatorModal } from '@/components/PostCreatorModal';
import { Button } from '@/components/ui/button';
import { isVideoUrl } from '@/utils/mux';
import { YardpassSpinner } from '@/components/LoadingSpinner';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';
import { EventTicketModal } from '@/components/EventTicketModal';

type FeedFilters = {
  dates: string[];
  locations: string[];
  categories: string[];
  searchRadius: number;
};

type CommentContext = {
  postId: string;
  eventId: string;
  eventTitle: string;
};

type TicketModalEvent = {
  id: string;
  title: string;
  start_at: string;
  venue?: string;
  address?: string;
  description?: string;
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

function postEngagementScore(item: FeedItem) {
  if (item.item_type !== 'post') return 0;
  const hasVideo = isVideoPost(item);
  const likes = item.metrics?.likes ?? 0;
  const comments = item.metrics?.comments ?? 0;
  const cappedLikes = Math.min(likes, 200);
  const cappedComments = Math.min(comments, 100);
  const engagementWeight = (cappedLikes * 0.4 + cappedComments * 0.6) / 200;
  return (hasVideo ? 2 : 0) + engagementWeight;
}

function interleaveFeedItems(items: FeedItem[]): FeedItem[] {
  if (items.length < 2) return items;
  const events: FeedItem[] = [];
  const posts: FeedItem[] = [];

  items.forEach((item) => {
    if (item.item_type === 'event') {
      events.push(item);
    } else if (item.item_type === 'post') {
      posts.push(item);
    }
  });

  const sortedPosts = posts.slice().sort((a, b) => postEngagementScore(b) - postEngagementScore(a));

  if (!events.length || !posts.length) {
    return events.length ? [...events] : sortedPosts;
  }

  const firstType = items[0].item_type;
  const primary = firstType === 'event' ? events : sortedPosts;
  const secondary = firstType === 'event' ? sortedPosts : events;
  const result: FeedItem[] = [];

  let pi = 0;
  let si = 0;
  while (pi < primary.length || si < secondary.length) {
    if (pi < primary.length) {
      result.push(primary[pi++]);
    }
    if (si < secondary.length && result.length % 2 === 0) {
      result.push(secondary[si++]);
    }
  }
  return result;
}

export default function UnifiedFeedListModern() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { requireAuth } = useAuthGuard();
  const { user } = useAuth();

  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [globalSoundEnabled, setGlobalSoundEnabled] = useState(false);
  const [pausedVideos, setPausedVideos] = useState<Record<string, boolean>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoplayReady, setAutoplayReady] = useState(false);

  const [commentContext, setCommentContext] = useState<CommentContext | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);
  const [postCreatorEventId, setPostCreatorEventId] = useState<string | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketModalEvent, setTicketModalEvent] = useState<TicketModalEvent | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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

  const { data: boosts, isLoading: boostsLoading } = useCampaignBoosts();
  const { share } = useShare();
  const { applyOptimisticLike, applyEngagementDelta } = useOptimisticReactions();

  const allFeedItems = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const blendedItems = useMemo(() => {
    let base = interleaveFeedItems(allFeedItems);
    if (!boosts?.length || !base.length) return base;

    const promotedIndexes = new Set<number>();
    for (let i = PROMOTED_INTERVAL - 1; i < base.length; i += PROMOTED_INTERVAL) {
      promotedIndexes.add(i);
    }

    const result: FeedItem[] = [];
    let boostIndex = 0;

    for (let i = 0; i < base.length; i++) {
      if (promotedIndexes.has(i) && boostIndex < boosts.length) {
        const boost = boosts[boostIndex++];
        result.push({
          item_id: `promoted-${boost.id}`,
          item_type: 'event',
          event_id: boost.event_id,
          event_title: boost.event_title || 'Promoted Event',
          event_category: boost.event_category || null,
          event_start_at: boost.event_start_at || null,
          event_venue: boost.event_venue || null,
          event_address: boost.event_address || null,
          event_cover_image: boost.event_cover_image || null,
          event_organizer_id: boost.organizer_user_id,
          event_organizer_name: boost.organizer_name,
          event_owner_context_type: boost.owner_context_type as 'user' | 'organization',
          event_description: null,
          created_at: new Date().toISOString(),
          promotion: {
            campaignId: boost.id,
            rateModel: boost.rate_model,
            cpmRateCredits: boost.cpm_rate_credits,
            cpcRateCredits: boost.cpc_rate_credits,
          },
        } as Extract<FeedItem, { item_type: 'event' }>);
      }
      result.push(base[i]);
    }
    return result;
  }, [allFeedItems, boosts]);

  const filteredItems = useMemo(() => blendedItems, [blendedItems]);

  const activeLocation = filters.locations[0] || 'Near Me';
  const activeDate = filters.dates[0] || 'Anytime';

  const registerInteraction = useCallback(() => {
    if (!autoplayReady) setAutoplayReady(true);
  }, [autoplayReady]);

  const containerProps = useMemo(() => {
    const baseProps = {
      role: 'feed' as const,
      'aria-label': 'Social feed',
      tabIndex: 0,
    };
    return baseProps;
  }, []);

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

  const handleLike = useCallback(
    (item: FeedItem, event?: React.MouseEvent) => {
      if (item.item_type !== 'post') return;
      applyOptimisticLike(item.item_id);
      registerInteraction();
    },
    [applyOptimisticLike, registerInteraction]
  );

  const handleComment = useCallback(
    (item: FeedItem) => {
      if (item.item_type !== 'post') return;
      setCommentContext({
        postId: item.item_id,
        eventId: item.event_id || '',
        eventTitle: item.event_title || 'Event',
      });
      setShowCommentModal(true);
      registerInteraction();
    },
    [registerInteraction]
  );

  const handleSharePost = useCallback(
    (item: FeedItem) => {
      if (item.item_type !== 'post') return;
      const url = `${window.location.origin}/post/${item.item_id}`;
      share(
        { url, title: item.content_text || 'Check out this post on Yardpass', text: item.content_text },
        () => {
          toast({ title: 'Link copied!', description: 'Share link copied to clipboard.' });
        }
      );
      registerInteraction();
    },
    [share, toast, registerInteraction]
  );

  const handleEventClick = useCallback(
    (eventId: string, item?: FeedItem) => {
      navigate(`/e/${eventId}`);
      registerInteraction();
    },
    [navigate, registerInteraction]
  );

  const handleOpenTickets = useCallback(
    (eventId: string, item?: FeedItem) => {
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
      } else if (item && item.item_type === 'post' && item.event_id) {
        setTicketModalEvent({
          id: item.event_id,
          title: item.event_title || 'Event',
          start_at: item.event_start_at || '',
          venue: item.event_venue || undefined,
          address: undefined,
          description: undefined,
        });
        setTicketModalOpen(true);
      }
      registerInteraction();
    },
    [registerInteraction]
  );

  const handleCreatePost = useCallback(
    (eventId?: string) => {
      requireAuth(() => {
        setPostCreatorEventId(eventId || null);
        setPostCreatorOpen(true);
      }, 'Sign in to create posts');
      registerInteraction();
    },
    [requireAuth, registerInteraction]
  );

  const handleReport = useCallback(() => {
    toast({ title: 'Reported', description: 'Thank you for your feedback.' });
  }, [toast]);

  if (status === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-black">
        <YardpassSpinner />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-neutral-950 text-white">
        <div className="space-y-1 text-center">
          <p className="text-lg font-semibold">We couldn't load your feed.</p>
          <p className="text-sm text-white/60">Refresh to try again or explore featured events.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => refetch()} variant="secondary">
            Refresh feed
          </Button>
          <Button onClick={() => navigate('/events')}>Browse events</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black text-white">
      {/* Background gradient layer */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-black" aria-hidden />
      
      {/* Radial glow at top */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-30%] h-[520px] w-[125%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(circle_at_center,_rgba(120,119,198,0.35)_0%,_rgba(32,31,60,0.05)_55%,_transparent_75%)] blur-3xl"
        aria-hidden
      />

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
        onMuteToggle={() => {
          registerInteraction();
          setGlobalSoundEnabled((prev) => !prev);
        }}
        onCreatePost={() => handleCreatePost()}
        onOpenMessages={() => navigate('/messages')}
      />

      {/* Feed Content - Snap Scroll */}
      <div 
        ref={scrollRef}
        className="hide-scrollbar relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', scrollSnapStop: 'always' }}
        {...containerProps}
      >
        {/* Add top padding to account for filters */}
        <div className="h-20" aria-hidden />

        {filteredItems.map((item, idx) => {
          const isPost = item.item_type === 'post';
          const paused = pausedVideos[item.item_id];
          const hasVideo = isPost && isVideoPost(item);
          const isVideoActive = isPost && idx === activeIndex && !paused && autoplayReady && hasVideo;

          return (
            <section
              key={item.item_id}
              className="snap-start snap-always h-dvh flex items-center px-0"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="mx-auto flex h-full w-full items-stretch">
                {item.item_type === 'event' ? (
                  <EventCardModern
                    item={item}
                    onOpenTickets={(eventId) => handleOpenTickets(eventId, item)}
                    onEventClick={(eventId) => handleEventClick(eventId, item)}
                    onCreatePost={() => handleCreatePost(item.event_id)}
                    onReport={handleReport}
                    onSoundToggle={() => {
                      registerInteraction();
                      setGlobalSoundEnabled((prev) => !prev);
                    }}
                    soundEnabled={globalSoundEnabled}
                    isVideoPlaying={false}
                  />
                ) : (
                  <UserPostCardModern
                    item={item}
                    onLike={() => handleLike(item)}
                    onComment={() => handleComment(item)}
                    onShare={() => handleSharePost(item)}
                    onEventClick={(eventId) => handleEventClick(eventId, item)}
                    onAuthorClick={(authorId) => navigate(`/u/${authorId}`)}
                    onCreatePost={() => handleCreatePost(item.event_id)}
                    onReport={handleReport}
                    onSoundToggle={() => {
                      registerInteraction();
                      setGlobalSoundEnabled((prev) => !prev);
                    }}
                    onVideoToggle={() => {
                      registerInteraction();
                      const isCurrentlyPaused = pausedVideos[item.item_id];
                      
                      setPausedVideos((prev) => ({
                        ...prev,
                        [item.item_id]: !isCurrentlyPaused,
                      }));
                      
                      if (isCurrentlyPaused) {
                        const otherVideos = filteredItems
                          .filter(otherItem =>
                            otherItem.item_type === 'post' &&
                            otherItem.item_id !== item.item_id &&
                            isVideoPost(otherItem)
                          )
                          .map(otherItem => otherItem.item_id);
                        
                        setPausedVideos(prev => {
                          const newState = { ...prev };
                          otherVideos.forEach(videoId => {
                            newState[videoId] = true;
                          });
                          return newState;
                        });
                      }
                    }}
                    onOpenTickets={(eventId) => handleOpenTickets(eventId, item)}
                    soundEnabled={globalSoundEnabled}
                    isVideoPlaying={isVideoActive}
                  />
                )}
              </div>
            </section>
          );
        })}

        <div ref={sentinelRef} className="h-32" />
        {isFetchingNextPage && (
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/70 backdrop-blur-xl">
            <BrandedSpinner size="sm" text="Loading more" />
          </div>
        )}

        {/* Add bottom padding to account for nav */}
        <div className="h-24" aria-hidden />
      </div>

      <FeedFilter
        isOpen={filtersOpen}
        onToggle={() => setFiltersOpen((open) => !open)}
        onFilterChange={(next) => {
          setFilters(next);
        }}
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
          navigate('/tickets');
        }}
      />

      <PostCreatorModal
        isOpen={postCreatorOpen}
        onClose={() => setPostCreatorOpen(false)}
        onSuccess={() => {
          setPostCreatorOpen(false);
          toast({
            title: 'Success',
            description: 'Your post has been created!',
          });
          refetch();
        }}
      />

      <FeedGestures />
      <FeedKeymap />
    </div>
  );
}

