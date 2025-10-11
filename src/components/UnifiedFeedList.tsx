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
import { PostCreatorModal } from '@/components/PostCreatorModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';
import { EventTicketModal } from '@/components/EventTicketModal';
import { isVideoUrl } from '@/utils/mux';

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
  dates: ['This Month'],
  locations: ['Near Me'],
  categories: [],
  searchRadius: 25,
};

const PROMOTED_INTERVAL = 4;

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

  if (!events.length || !posts.length) {
    return items;
  }

  const firstType = items[0].item_type;
  const primary = firstType === 'event' ? events : posts;
  const secondary = firstType === 'event' ? posts : events;

  const result: FeedItem[] = [];
  let primaryIndex = 0;
  let secondaryIndex = 0;

  while (primaryIndex < primary.length || secondaryIndex < secondary.length) {
    if (primaryIndex < primary.length) {
      result.push(primary[primaryIndex]);
      primaryIndex += 1;
    }

    if (secondaryIndex < secondary.length) {
      result.push(secondary[secondaryIndex]);
      secondaryIndex += 1;
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
  const [filters, setFilters] = useState<FeedFilters>(() => ({ ...DEFAULT_FILTERS }));
  const [activeIndex, setActiveIndex] = useState(0);
  const [pausedVideos, setPausedVideos] = useState<Record<string, boolean>>({});
  const [globalSoundEnabled, setGlobalSoundEnabled] = useState(false);
  const [autoplayReady, setAutoplayReady] = useState(() => {
    if (typeof navigator === 'undefined' || !('userActivation' in navigator)) {
      return false;
    }
    try {
      return (navigator as any).userActivation?.hasBeenActive ?? false;
    } catch (error) {
      console.debug('⚠️ Unable to determine user activation state', error);
      return false;
    }
  });

  const registerInteraction = useCallback(() => {
    setAutoplayReady((prev) => {
      if (!prev && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.debug('🎬 Feed interaction detected - unlocking autoplay');
      }
      return true;
    });
  }, []);
  const [commentContext, setCommentContext] = useState<CommentContext | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketModalEvent, setTicketModalEvent] = useState<TicketModalEvent | null>(null);
  const [postCreatorOpen, setPostCreatorOpen] = useState(false);

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

  const filteredItems = useMemo(() => {
    if (!blendedItems.length) return blendedItems;

    const normalizeDate = (item: FeedItem): Date | null => {
      const source = item.event_starts_at ?? item.sort_ts;
      if (!source) return null;
      const parsed = new Date(source);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const matchesDateFilters = (item: FeedItem) => {
      if (!filters.dates.length) return true;
      const eventDate = normalizeDate(item);
      if (!eventDate) return true;

      const now = new Date();

      return filters.dates.some((filter) => {
        switch (filter) {
          case 'This Month': {
            return (
              eventDate.getFullYear() === now.getFullYear() &&
              eventDate.getMonth() === now.getMonth()
            );
          }
          case 'This Weekend': {
            const day = now.getDay();
            const diffToFriday = (5 - day + 7) % 7;
            const friday = new Date(now);
            friday.setDate(now.getDate() + diffToFriday);
            friday.setHours(0, 0, 0, 0);
            const sunday = new Date(friday);
            sunday.setDate(friday.getDate() + 2);
            sunday.setHours(23, 59, 59, 999);
            return eventDate >= friday && eventDate <= sunday;
          }
          case 'Tonight': {
            const tonight = new Date(now);
            tonight.setHours(0, 0, 0, 0);
            const endOfDay = new Date(tonight);
            endOfDay.setHours(23, 59, 59, 999);
            return eventDate >= tonight && eventDate <= endOfDay;
          }
          case 'Halloween':
            return eventDate.getMonth() === 9 && eventDate.getDate() === 31;
          case 'Next Week': {
            const start = new Date(now);
            start.setDate(now.getDate() + 7);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            return eventDate >= start && eventDate <= end;
          }
          case 'Next Month': {
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const followingMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1);
            return eventDate >= nextMonth && eventDate < followingMonth;
          }
          default:
            return true;
        }
      });
    };

    const matchesLocationFilters = (item: FeedItem) => {
      if (!filters.locations.length) return true;
      const locationText = item.event_location?.toLowerCase?.() ?? '';
      return filters.locations.some((location) => {
        if (location === 'Near Me') return true;
        return locationText.includes(location.toLowerCase());
      });
    };

    const matchesCategoryFilters = (item: FeedItem) => {
      if (!filters.categories.length) return true;
      const category = item.promotion?.objective ?? item.event_description ?? '';
      return filters.categories.some((needle) =>
        category.toLowerCase().includes(needle.toLowerCase())
      );
    };

    const matchesRadius = (item: FeedItem) => {
      const radius = filters.searchRadius ?? 0;
      if (!radius || radius >= 100) return true;
      const distance = (item as unknown as { distance_miles?: number | null }).distance_miles;
      if (typeof distance !== 'number') return true;
      return distance <= radius;
    };

    return blendedItems.filter(
      (item) =>
        matchesDateFilters(item) &&
        matchesLocationFilters(item) &&
        matchesCategoryFilters(item) &&
        matchesRadius(item)
    );
  }, [blendedItems, filters]);

  useEffect(() => {
    itemRefs.current = new Array(filteredItems.length).fill(null);
  }, [filteredItems]);

  useEffect(() => {
    if (autoplayReady) return undefined;
    if (typeof window === 'undefined') return undefined;
    const timer = window.setTimeout(() => setAutoplayReady(true), 800);
    return () => window.clearTimeout(timer);
  }, [autoplayReady]);

  useEffect(() => {
    if (activeIndex >= filteredItems.length) {
      setActiveIndex(filteredItems.length > 0 ? filteredItems.length - 1 : 0);
    }
  }, [activeIndex, filteredItems.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filters]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        const next = visible[0];
        if (!next) {
          return;
        }

        const idx = Number((next.target as HTMLElement).dataset.index);
        if (!Number.isNaN(idx)) {
          setActiveIndex(idx);
        }
      },
      { root: null, threshold: [0.3, 0.5, 0.7], rootMargin: '0px 0px -10% 0px' }
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [filteredItems]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const markInteraction = () => registerInteraction();

    container.addEventListener('scroll', markInteraction, { passive: true });
    container.addEventListener('click', markInteraction);
    container.addEventListener('touchstart', markInteraction, { passive: true });
    window.addEventListener('keydown', markInteraction);

    return () => {
      container.removeEventListener('scroll', markInteraction);
      container.removeEventListener('click', markInteraction);
      container.removeEventListener('touchstart', markInteraction);
      window.removeEventListener('keydown', markInteraction);
    };
  }, [registerInteraction]);

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
    (eventId: string, item?: FeedItem) => {
      const source = item ?? blendedItems.find((candidate) => candidate.event_id === eventId);
      if (!source) {
        setTicketModalEvent({
          id: eventId,
          title: 'Event tickets',
          start_at: new Date().toISOString(),
        });
      } else {
        const [venue, ...restLocation] = (source.event_location ?? '')
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);

        setTicketModalEvent({
          id: source.event_id,
          title: source.event_title ?? 'Event tickets',
          start_at: source.event_starts_at ?? source.sort_ts,
          venue: venue,
          address: restLocation.length ? restLocation.join(', ') : source.event_location,
          description: source.event_description ?? undefined,
        });
      }

      setTicketModalOpen(true);
      registerInteraction();
    },
    [blendedItems, registerInteraction]
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
        setPostCreatorOpen(true);
      }, 'Sign in to share an update');
    },
    [requireAuth]
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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-black" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[-30%] h-[520px] w-[125%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(circle_at_center,_rgba(120,119,198,0.35)_0%,_rgba(32,31,60,0.05)_55%,_transparent_75%)] blur-3xl"
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 pt-6 sm:px-6">
        <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                <Sparkles className="h-3 w-3" /> Curated feed
              </span>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold leading-snug text-white sm:text-3xl">
                  Discover experiences near {activeLocation}
                </h1>
                <p className="max-w-2xl text-sm text-white/70 sm:text-base">
                  A strategic blend of events, creator updates, and boosted spotlights to help you plan what&apos;s next. Refine the mix or jump straight into the moment.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="flex h-11 items-center gap-2 self-start rounded-full border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white shadow-none transition hover:bg-white/20 sm:self-center"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" /> Tune feed
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-white/75">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1">
              <MapPin className="h-3 w-3" /> {activeLocation}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1">
              <Compass className="h-3 w-3" /> {activeDate}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase tracking-[0.18em] text-[10px] text-white/60">
              Organic &amp; boosted mix
            </span>
            {boostsLoading && (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Calibrating boosts
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative h-full snap-y snap-mandatory overflow-y-auto scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
        {...containerProps}
      >
        <div className="h-24" aria-hidden="true" />
        {filteredItems.map((item, idx) => {
          const isPost = item.item_type === 'post';
          const paused = pausedVideos[item.item_id];
          const hasVideo = isPost && Array.isArray(item.media_urls) && item.media_urls.some((url) => isVideoUrl(url));
          const isVideoActive = isPost && idx === activeIndex && !paused && autoplayReady && hasVideo;

          // Debug video visibility and autoplay triggers
          if (import.meta.env?.DEV && isPost && item.media_urls?.length) {
            console.log('📱 Feed video visibility:', {
              postId: item.item_id,
              idx,
              activeIndex,
              isVideoActive,
              paused,
              autoplayReady,
              hasMedia: !!item.media_urls?.length,
              mediaUrls: item.media_urls,
              debug_calculation: {
                isPost,
                idx_equals_activeIndex: idx === activeIndex,
                not_paused: !paused,
                autoplayReady,
                final_result: isVideoActive,
              },
            });
          }

          return (
            <section
              key={`${item.item_type}-${item.item_id}-${idx}`}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              data-index={idx}
              className="snap-start px-3 sm:px-6"
            >
              <div className="mx-auto flex h-[calc(100dvh-6.5rem)] w-full max-w-5xl items-stretch">
                <div className="relative isolate flex h-full w-full overflow-hidden rounded-[32px] border border-white/12 bg-white/5 shadow-[0_40px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                  <div
                    className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16)_0%,_transparent_55%)] opacity-70"
                    aria-hidden
                  />
                  {item.item_type === 'event' ? (
                    <EventCard
                      item={item}
                      onOpenTickets={(eventId) => handleOpenTickets(eventId)}
                      onEventClick={(eventId) => handleEventClick(eventId)}
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
                    <UserPostCard
                      item={item}
                      onLike={() => handleLike(item)}
                      onComment={() => handleComment(item)}
                      onShare={() => handleSharePost(item)}
                      onEventClick={(eventId) => handleEventClick(eventId)}
                      onAuthorClick={(authorId) => navigate(`/u/${authorId}`)}
                      onCreatePost={() => handleCreatePost(item.event_id)}
                      onReport={handleReport}
                      onSoundToggle={() => {
                        registerInteraction();
                        setGlobalSoundEnabled((prev) => !prev);
                      }}
                      onVideoToggle={() => {
                        registerInteraction();
                        setPausedVideos((prev) => ({
                          ...prev,
                          [item.item_id]: !prev[item.item_id],
                        }));
                      }}
                      onOpenTickets={(eventId) => handleOpenTickets(eventId, item)}
                      soundEnabled={globalSoundEnabled}
                      isVideoPlaying={isVideoActive}
                    />
                  )}
                </div>
              </div>
            </section>
          );
        })}
        <div ref={sentinelRef} className="h-32" />
        {isFetchingNextPage && (
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/70 backdrop-blur-xl">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading more
          </div>
        )}
        {!filteredItems.length && blendedItems.length > 0 && (
          <div className="mx-auto flex h-[60vh] w-full max-w-4xl flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/75 backdrop-blur-xl">
            <p className="text-lg font-semibold text-white sm:text-2xl">No matches for your filters yet.</p>
            <p className="max-w-md text-sm sm:text-base">
              Soften your filters or widen the search radius to reveal more curated events near {activeLocation}. We&apos;ll keep refining the recommendations.
            </p>
            <Button
              variant="secondary"
              className="rounded-full border border-white/20 bg-white/10 px-6 text-sm text-white hover:bg-white/20"
              onClick={() => setFilters({ ...DEFAULT_FILTERS })}
            >
              Reset filters
            </Button>
          </div>
        )}
        {!filteredItems.length && !blendedItems.length && (
          <div className="mx-auto flex h-[60vh] w-full max-w-4xl flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/75 backdrop-blur-xl">
            <p className="text-lg font-semibold text-white sm:text-2xl">Your feed is warming up.</p>
            <p className="max-w-md text-sm sm:text-base">
              Follow organizers you love, explore events near {activeLocation}, or share your first update to unlock a richer feed experience tailored to you.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button className="rounded-full bg-white text-black hover:bg-white/90" onClick={() => navigate('/events')}>
                Explore events
              </Button>
              <Button
                variant="secondary"
                className="rounded-full border border-white/20 bg-white/10 px-5 text-sm text-white hover:bg-white/20"
                onClick={() => requireAuth(() => navigate('/create-event'), 'Sign in to create events')}
              >
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
          // Optionally refresh the feed
          refetch();
        }}
      />
    </div>
  );
}
