import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, SlidersHorizontal, MapPin, Compass, Loader2 } from 'lucide-react';
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
import { EventCard } from '@/components/EventCard';
import { UserPostCard } from '@/components/UserPostCard';
import CommentModal from '@/components/CommentModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';

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

const DEFAULT_FILTERS: FeedFilters = {
  dates: ['This Month'],
  locations: ['Near Me'],
  categories: [],
  searchRadius: 25,
};

const PROMOTED_INTERVAL = 4;

function interleaveFeedItems(items: FeedItem[]): FeedItem[] {
  if (items.length < 2) return items;

  const hasEvents = items.some((item) => item.item_type === 'event');
  const hasPosts = items.some((item) => item.item_type === 'post');

  if (!hasEvents || !hasPosts) {
    return items;
  }

  const result = [...items];

  for (let i = 1; i < result.length; i += 1) {
    const prevType = result[i - 1].item_type;
    const currentType = result[i].item_type;

    if (prevType === currentType) {
      const swapIndex = result.findIndex(
        (candidate, idx) => idx > i && candidate.item_type !== prevType
      );

      if (swapIndex !== -1) {
        const [swapItem] = result.splice(swapIndex, 1);
        result.splice(i, 0, swapItem);
      }
    }
  }

  return result;
}

function normalizeBoost(row: CampaignBoostRow): FeedItem {
  const id = `boost-${row.campaign_id}-${row.creative_id ?? row.event_id}`;
  return {
    item_type: 'event',
    sort_ts: new Date().toISOString(),
    item_id: id,
    event_id: row.event_id,
    event_title: row.event_title ?? 'Featured experience',
    event_description: row.event_description ?? row.body_text ?? '',
    event_starts_at: row.event_starts_at ?? null,
    event_cover_image: row.event_cover_image || row.media_url || DEFAULT_EVENT_COVER,
    event_organizer: row.organizer_name ?? 'Featured organizer',
    event_organizer_id: row.organizer_id,
    event_owner_context_type: row.owner_context_type ?? 'organization',
    event_location: row.event_location || row.event_city || 'Happening soon',
    author_id: null,
    author_name: null,
    author_badge: null,
    author_social_links: null,
    media_urls: null,
    content: null,
    metrics: { likes: 0, comments: 0, viewer_has_liked: false },
    sponsor: null,
    sponsors: null,
    promotion: {
      campaignId: row.campaign_id,
      creativeId: row.creative_id,
      objective: row.objective,
      headline: row.headline ?? undefined,
      body: row.body_text ?? undefined,
      ctaLabel: row.cta_label ?? undefined,
      ctaUrl: row.cta_url ?? undefined,
      priority: row.priority ?? undefined,
      rateModel: row.default_rate_model ?? undefined,
      cpmRateCredits: row.cpm_rate_credits ?? undefined,
      cpcRateCredits: row.cpc_rate_credits ?? undefined,
      remainingCredits: row.remaining_credits ?? undefined,
      frequencyCapPerUser: row.frequency_cap_per_user ?? undefined,
      frequencyCapPeriod: row.frequency_cap_period ?? undefined,
    },
  };
}

function renderLoadingState() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-neutral-950">
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black" />
      <div className="relative z-10 flex h-full flex-col gap-6 px-6 pt-20">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24 bg-white/10" />
          <Skeleton className="h-10 w-1/2 bg-white/10" />
          <Skeleton className="h-4 w-40 bg-white/10" />
        </div>
        <div className="grid gap-4">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="h-[60vh] rounded-3xl border border-white/5 bg-white/5">
              <Skeleton className="h-full w-full rounded-3xl bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UnifiedFeedList() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);

  const { user } = useAuth();
  const { requireAuth } = useAuthGuard();
  const { toggleLike, getOptimisticData } = useOptimisticReactions();
  const { sharePost } = useShare();
  const { toast } = useToast();

  const { containerProps } = FeedGestures();
  FeedKeymap();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pausedVideos, setPausedVideos] = useState<Record<string, boolean>>({});
  const [globalSoundEnabled, setGlobalSoundEnabled] = useState(true);
  const [commentContext, setCommentContext] = useState<CommentContext | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);

  const {
    items,
    status,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    applyEngagementDelta,
  } = useUnifiedFeedInfinite(30);

  const { data: campaignBoosts = [], isLoading: boostsLoading } = useCampaignBoosts({
    placement: 'feed',
    limit: 8,
    userId: user?.id ?? null,
  });

  const organicItems = items ?? [];
  const interleavedOrganicItems = useMemo(() => interleaveFeedItems(organicItems), [organicItems]);
  const normalizedBoosts = useMemo(() => {
    if (!campaignBoosts?.length) return [] as FeedItem[];
    const seen = new Set<string>();
    return campaignBoosts
      .map(normalizeBoost)
      .filter((boost) => {
        if (!boost.event_id) return false;
        if (seen.has(boost.item_id)) return false;
        seen.add(boost.item_id);
        return true;
      })
      .sort((a, b) => (b.promotion?.priority ?? 0) - (a.promotion?.priority ?? 0));
  }, [campaignBoosts]);

  const blendedItems = useMemo(() => {
    if (!interleavedOrganicItems.length) {
      return normalizedBoosts.length ? normalizedBoosts : interleavedOrganicItems;
    }

    if (!normalizedBoosts.length) {
      return interleavedOrganicItems;
    }

    const boostsQueue = [...normalizedBoosts];
    const output: FeedItem[] = [];

    interleavedOrganicItems.forEach((item, idx) => {
      if (idx > 0 && idx % PROMOTED_INTERVAL === 0 && boostsQueue.length) {
        output.push(boostsQueue.shift()!);
      }
      output.push(item);
    });

    return boostsQueue.length ? [...output, ...boostsQueue] : output;
  }, [interleavedOrganicItems, normalizedBoosts]);

  useEffect(() => {
    itemRefs.current = new Array(blendedItems.length).fill(null);
  }, [blendedItems.length]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(idx)) {
              setActiveIndex(idx);
            }
          }
        }
      },
      { root: container, threshold: 0.6 }
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [blendedItems.length]);

  useEffect(() => {
    const container = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!container || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root: container, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleLike = useCallback(
    (item: Extract<FeedItem, { item_type: 'post' }>) => {
      const snapshot = getOptimisticData(item.item_id, {
        isLiked: item.metrics.viewer_has_liked ?? false,
        likeCount: item.metrics.likes ?? 0,
      });

      requireAuth(() => {
        void (async () => {
          const result = await toggleLike(
            item.item_id,
            snapshot.isLiked,
            snapshot.likeCount
          );
          if (result.ok) {
            applyEngagementDelta(item.item_id, {
              mode: 'absolute',
              like_count: result.likeCount,
              viewer_has_liked: result.isLiked,
            });
          }
        })();
      }, 'Please sign in to like posts');
    },
    [applyEngagementDelta, getOptimisticData, requireAuth, toggleLike]
  );

  const handleComment = useCallback(
    (item: Extract<FeedItem, { item_type: 'post' }>) => {
      requireAuth(() => {
        setCommentContext({
          postId: item.item_id,
          eventId: item.event_id,
          eventTitle: item.event_title,
        });
        setShowCommentModal(true);
      }, 'Please sign in to comment');
    },
    [requireAuth]
  );

  const handleSharePost = useCallback(
    (item: Extract<FeedItem, { item_type: 'post' }>) => {
      sharePost(item.item_id, item.event_title, item.content ?? undefined);
    },
    [sharePost]
  );

  const handleOpenTickets = useCallback(
    (eventId: string) => {
      navigate(`/event/${eventId}?view=tickets`);
    },
    [navigate]
  );

  const handleEventClick = useCallback(
    (eventId: string) => {
      navigate(`/event/${eventId}`);
    },
    [navigate]
  );

  const handleCreatePost = useCallback(
    (eventId: string) => {
      requireAuth(() => {
        navigate(`/event/${eventId}?compose=post`);
      }, 'Sign in to share an update');
    },
    [navigate, requireAuth]
  );

  const handleReport = useCallback(() => {
    toast({
      title: 'Report received',
      description: 'Thanks for flagging this. Our safety team will take a look.',
    });
  }, [toast]);

  const activeLocation = filters.locations[0] ?? 'Near you';
  const activeDate = filters.dates[0] ?? 'Anytime';

  if (status === 'pending') {
    return renderLoadingState();
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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black via-black/40 to-black" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col gap-3 px-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
              <Sparkles className="h-3 w-3" /> For you
            </span>
            <Badge variant="outline" className="border-white/30 text-white/80">
              <MapPin className="mr-1 h-3 w-3" /> {activeLocation}
            </Badge>
            <Badge variant="outline" className="border-white/30 text-white/80">
              <Compass className="mr-1 h-3 w-3" /> {activeDate}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="pointer-events-auto h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filter feed"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="pointer-events-auto flex flex-wrap gap-2 text-xs text-white/70">
          <span>Discover live experiences, creator moments, and boosted spotlights tailored to you.</span>
          {boostsLoading && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
              <Loader2 className="h-3 w-3 animate-spin" /> calibrating boosts
            </span>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative h-full snap-y snap-mandatory overflow-y-auto scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
        {...containerProps}
      >
        <div className="h-24" aria-hidden="true" />
        {blendedItems.map((item, idx) => {
          const isPost = item.item_type === 'post';
          const paused = pausedVideos[item.item_id];
          const isVideoActive = isPost && idx === activeIndex && !paused;

          return (
            <section
              key={`${item.item_type}-${item.item_id}-${idx}`}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              data-index={idx}
              className="snap-start"
            >
              <div className="flex h-[calc(100dvh-6rem)] w-full items-stretch">
                {item.item_type === 'event' ? (
                  <EventCard
                    item={item}
                    onOpenTickets={(eventId) => handleOpenTickets(eventId)}
                    onEventClick={(eventId) => handleEventClick(eventId)}
                    onCreatePost={() => handleCreatePost(item.event_id)}
                    onReport={handleReport}
                    onSoundToggle={() => setGlobalSoundEnabled((prev) => !prev)}
                    soundEnabled={globalSoundEnabled}
                    isVideoPlaying={false}
                  />
                ) : (
                  <UserPostCard
                    item={item}
                    onLike={() => handleLike(item)}
                    onComment={() => handleComment(item)}
                    onShare={() => handleSharePost(item)}
                    onEventClick={(eventId) => handleEventClick(eventId)}
                    onAuthorClick={(authorId) => navigate(`/u/${authorId}`)}
                    onCreatePost={() => handleCreatePost(item.event_id)}
                    onReport={handleReport}
                    onSoundToggle={() => setGlobalSoundEnabled((prev) => !prev)}
                    onVideoToggle={() =>
                      setPausedVideos((prev) => ({
                        ...prev,
                        [item.item_id]: !prev[item.item_id],
                      }))
                    }
                    onOpenTickets={(eventId) => handleOpenTickets(eventId)}
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
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading more
          </div>
        )}
        {!blendedItems.length && (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center text-white/70">
            <p className="text-lg font-semibold text-white">We don't have anything to show yet.</p>
            <p className="text-sm max-w-sm">
              Follow organizers you love, explore events near {activeLocation}, or create your first post to personalize this feed.
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={() => navigate('/events')}>Explore events</Button>
              <Button variant="secondary" onClick={() => requireAuth(() => navigate('/create-event'), 'Sign in to create events')}>
                Host an experience
              </Button>
            </div>
          </div>
        )}
        <div className="h-24" aria-hidden="true" />
      </div>

      <FeedFilter
        isOpen={filtersOpen}
        onToggle={() => setFiltersOpen((open) => !open)}
        onFilterChange={(next) => {
          setFilters(next);
        }}
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
    </div>
  );
}
