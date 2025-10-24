import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, MapPin, Compass } from 'lucide-react';
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
import { YardpassSpinner } from '@/components/LoadingSpinner';

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
  dates: [], // Show all dates by default to display all available videos
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

  const sortedPosts = posts
    .slice()
    .sort((a, b) => postEngagementScore(b) - postEngagementScore(a));

  if (!events.length || !posts.length) {
    return events.length ? [...events] : sortedPosts;
  }

  const firstType = items[0].item_type;
  const primary = firstType === 'event' ? events : sortedPosts;
  const secondary = firstType === 'event' ? sortedPosts : events;

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
  const scrollUpdateRafRef = useRef<number | null>(null);

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
  const [lastActiveVideoId, setLastActiveVideoId] = useState<string | null>(null);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const lastScrollTime = useRef<number>(Date.now());
  const lastScrollPosition = useRef<number>(0);
  const [autoplayReady, setAutoplayReady] = useState(() => {
    if (typeof navigator === 'undefined' || !('userActivation' in navigator)) {
      return false;
    }
    try {
      return (navigator as any).userActivation?.hasBeenActive ?? false;
    } catch (error) {
      if (import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.debug('⚠️ Unable to determine user activation state', error);
      }
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
    // Preserve existing element refs while trimming any that are no longer rendered.
    itemRefs.current = itemRefs.current.slice(0, filteredItems.length);
  }, [filteredItems.length]);

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
    setActiveIndex((prev) => {
      if (!filteredItems.length) return 0;
      if (prev < filteredItems.length) return prev;

      const firstVideoIndex = filteredItems.findIndex(isVideoPost);
      return firstVideoIndex >= 0 ? firstVideoIndex : 0;
    });
  }, [filteredItems]);

  const updateActiveIndexFromScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !filteredItems.length) return;

    const containerRect = container.getBoundingClientRect();
    const viewportTop = containerRect.top;
    const viewportBottom = containerRect.bottom;
    const viewportHeight = Math.max(1, viewportBottom - viewportTop);
    const viewportCenter = viewportTop + viewportHeight / 2;

    let bestVideo: { index: number; score: number } | null = null;
    let bestFallback: { index: number; score: number } | null = null;

    itemRefs.current.forEach((el, index) => {
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const height = Math.max(rect.height, 1);
      const intersectionTop = Math.max(rect.top, viewportTop);
      const intersectionBottom = Math.min(rect.bottom, viewportBottom);
      const intersectionHeight = Math.max(0, intersectionBottom - intersectionTop);

      if (intersectionHeight <= 0) return;

      const visibilityRatio = intersectionHeight / height;
      const distanceToCenter = Math.abs(rect.top + height / 2 - viewportCenter);
      const normalizedDistance = 1 - Math.min(distanceToCenter / (viewportHeight / 2), 1);
      const velocityBoost = scrollVelocity > 0.75 ? 0.08 : 0;

      const score = visibilityRatio * 0.7 + normalizedDistance * 0.3 + velocityBoost;

      const item = filteredItems[index];
      const video = item ? isVideoPost(item) : false;

      if (video) {
        if (!bestVideo || score > bestVideo.score) {
          bestVideo = { index, score };
        }
      }

      if (!bestFallback || score > bestFallback.score) {
        bestFallback = { index, score };
      }
    });

    const minVideoScore = scrollVelocity > 0.6 ? 0.25 : 0.35;
    const candidate = bestVideo && bestVideo.score >= minVideoScore ? bestVideo : bestFallback;

    if (candidate) {
      setActiveIndex((prev) => (prev === candidate.index ? prev : candidate.index));
    }
  }, [filteredItems, scrollVelocity]);

  useEffect(() => {
    updateActiveIndexFromScroll();
  }, [updateActiveIndexFromScroll, filteredItems.length]);

  useEffect(() => {
    const handleResize = () => updateActiveIndexFromScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateActiveIndexFromScroll]);

  // Intelligent video state management - pause previous video when switching to new one
  useEffect(() => {
    const currentItem = filteredItems[activeIndex];
    if (!currentItem || currentItem.item_type !== 'post') return;

    const currentVideoId = currentItem.item_id;
    const isVideo = isVideoPost(currentItem);
    
    if (isVideo && lastActiveVideoId && lastActiveVideoId !== currentVideoId) {
      // Pause the previous video when switching to a new one
      setPausedVideos((prev) => ({
        ...prev,
        [lastActiveVideoId]: true,
      }));
    }

    if (isVideo) {
      // Ensure the active video is not marked as paused so autoplay can resume
      setPausedVideos((prev) => {
        if (!prev[currentVideoId]) return prev;

        const next = { ...prev };
        delete next[currentVideoId];
        return next;
      });

      setLastActiveVideoId(currentVideoId);
    }
  }, [activeIndex, filteredItems, lastActiveVideoId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const markInteraction = () => registerInteraction();

    const queueActiveUpdate = () => {
      if (scrollUpdateRafRef.current != null) {
        cancelAnimationFrame(scrollUpdateRafRef.current);
      }

      scrollUpdateRafRef.current = window.requestAnimationFrame(() => {
        scrollUpdateRafRef.current = null;
        updateActiveIndexFromScroll();
      });
    };

    // Track scroll velocity for more responsive video switching
    const handleScroll = () => {
      const now = Date.now();
      const currentPosition = container.scrollTop;
      const timeDelta = now - lastScrollTime.current;
      const positionDelta = Math.abs(currentPosition - lastScrollPosition.current);
      
      if (timeDelta > 0) {
        const velocity = positionDelta / timeDelta;
        setScrollVelocity(velocity);
      }

      lastScrollTime.current = now;
      lastScrollPosition.current = currentPosition;

      queueActiveUpdate();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    container.addEventListener('scroll', markInteraction, { passive: true });
    container.addEventListener('click', markInteraction);
    container.addEventListener('touchstart', markInteraction, { passive: true });
    window.addEventListener('keydown', markInteraction);

    return () => {
      if (scrollUpdateRafRef.current != null) {
        cancelAnimationFrame(scrollUpdateRafRef.current);
        scrollUpdateRafRef.current = null;
      }
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('scroll', markInteraction);
      container.removeEventListener('click', markInteraction);
      container.removeEventListener('touchstart', markInteraction);
      window.removeEventListener('keydown', markInteraction);
    };
  }, [registerInteraction, updateActiveIndexFromScroll]);

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
  const normalizedLocation = activeLocation.replace(/^Near\s+/i, '').trim();
  const locationHeading = normalizedLocation ? `Near ${normalizedLocation}` : 'Near you';
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

      <div
        ref={scrollRef}
        className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', scrollSnapStop: 'always' }}
        {...containerProps}
      >
        {/* Title Section */}
        <div className="relative z-40 px-3 pt-4 pb-2 sm:px-4">
          <div className="mx-auto w-full max-w-5xl text-center">
            <h1 className="text-2xl font-bold text-white mb-1">LAUNDACH</h1>
            <h2 className="text-4xl font-bold text-white">YARD-PASS</h2>
          </div>
        </div>
        
        <header className="sticky top-0 z-30 bg-gradient-to-b from-black/95 via-black/70 to-transparent px-3 pt-2 pb-2 backdrop-blur-md sm:px-4">
          <div className="mx-auto w-full max-w-5xl">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 shadow-lg backdrop-blur-xl">
              <h1 className="text-sm font-semibold leading-tight text-white sm:text-base">{locationHeading}</h1>
              <Button
                variant="secondary"
                size="sm"
                className="flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-medium text-white shadow-none transition hover:bg-white/20"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="h-3 w-3" /> Tune
              </Button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] text-white/70">
              <button
                onClick={() => setFiltersOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 transition-all hover:bg-black/40 hover:border-white/20 active:scale-95 touch-manipulation"
                aria-label="Change location filter"
              >
                <MapPin className="h-2.5 w-2.5" /> {activeLocation}
              </button>
              <button
                onClick={() => setFiltersOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 transition-all hover:bg-black/40 hover:border-white/20 active:scale-95 touch-manipulation"
                aria-label="Change date filter"
              >
                <Compass className="h-2.5 w-2.5" /> {activeDate}
              </button>
              {boostsLoading && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  <BrandedSpinner size="sm" text="Calibrating" />
                </span>
              )}
            </div>
          </div>
        </header>
        {filteredItems.map((item, idx) => {
          const isPost = item.item_type === 'post';
          const paused = pausedVideos[item.item_id];
          const hasVideo = isPost && isVideoPost(item);
          const isVideoActive = isPost && idx === activeIndex && !paused && autoplayReady && hasVideo;


          return (
            <section
              key={`${item.item_type}-${item.item_id}-${idx}`}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              data-index={idx}
              className="snap-start snap-always h-dvh flex items-center px-3 sm:px-6"
            >
              <div className="mx-auto flex h-[calc(100dvh-5rem)] w-full max-w-5xl items-stretch">
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
                        const isCurrentlyPaused = pausedVideos[item.item_id];
                        
                        setPausedVideos((prev) => ({
                          ...prev,
                          [item.item_id]: !isCurrentlyPaused,
                        }));
                        
                        // If we're unpausing this video, pause all other videos
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
