import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ArrowLeft, Search, X, SlidersHorizontal, Calendar as CalendarIcon, Star, Sparkles } from 'lucide-react';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useInteractionTracking } from '@/hooks/useInteractionTracking';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow, isSameDay, nextSaturday, nextSunday } from 'date-fns';
import { cn } from '@/lib/utils';
import { FilterChip } from './search/FilterChip';
import { EventCard } from './search/EventCard';
import { SkeletonGrid, EmptyState } from './search/SearchPageComponents';
import { useSmartSearch } from '@/hooks/useSmartSearch';
import { useCampaignBoosts } from '@/hooks/useCampaignBoosts';
import { canServeCampaign, logAdClick, logAdImpression } from '@/lib/adTracking';

interface SearchPageProps {
  onBack: () => void;
  onEventSelect: (eventId: string) => void;
}

const categories = [
  'All', 'Music', 'Food & Drink', 'Art & Culture', 'Sports & Fitness', 
  'Business & Professional', 'Community', 'Technology', 'Other'
];

// ————————————————————————————————————————
// Mock fallback (unchanged)
// ————————————————————————————————————————
const mockSearchResults = [
  {
    id: '1',
    title: 'Summer Music Festival 2024',
    description: 'Three days of incredible music with top artists',
    organizer: 'LiveNation Events',
    organizerId: '101',
    category: 'Music',
    date: 'July 15, 2025',
    location: 'Central Park, NYC',
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?auto=format&fit=crop&w=1200&q=60',
    attendeeCount: 1243,
    priceFrom: 89,
    rating: 4.8,
  },
  {
    id: '2',
    title: 'Street Food Fiesta',
    description: 'Taste authentic flavors from around the world',
    organizer: 'Foodie Adventures',
    organizerId: '102',
    category: 'Food & Drink',
    date: 'August 8, 2025',
    location: 'Brooklyn Bridge Park',
    coverImage: 'https://images.unsplash.com/photo-1551883709-2516220df0bc?auto=format&fit=crop&w=1200&q=60',
    attendeeCount: 567,
    priceFrom: 25,
    rating: 4.6,
  },
  {
    id: '3',
    title: 'Contemporary Art Showcase',
    description: 'Discover emerging artists and groundbreaking installations',
    organizer: 'Modern Gallery NYC',
    organizerId: '103',
    category: 'Art & Culture',
    date: 'September 2, 2025',
    location: 'SoHo Art District',
    coverImage: 'https://images.unsplash.com/photo-1713779490284-a81ff6a8ffae?auto=format&fit=crop&w=1200&q=60',
    attendeeCount: 298,
    priceFrom: 35,
    rating: 4.9,
  }
];

const LOCAL_RECENT_KEY = 'yp_recent_searches';

export default function SearchPage({ onBack, onEventSelect }: SearchPageProps) {
  const { trackEvent } = useAnalyticsIntegration();
  const { user } = useAuth();
  const { data: recommendations, loading: recLoading, error: recError } = useRecommendations(user?.id, 8);
  const { trackInteraction } = useInteractionTracking();
  const { data: searchBoosts = [] } = useCampaignBoosts({
    placement: 'search_results',
    limit: 8,
    userId: user?.id ?? null,
  });

  // URL-synced state
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const cat = params.get('cat') || 'All';
  const city = params.get('city') || '';
  const sort = (params.get('sort') || 'date_asc') as 'date_asc'|'price_asc'|'price_desc'|'attendees_desc';
  const min = params.get('min') || '';
  const max = params.get('max') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';

  // recent searches
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_RECENT_KEY) || '[]'); } catch { return []; }
  });
  const pushRecent = useCallback((s: string) => {
    if (!s.trim()) return;
    const next = [s.trim(), ...recent.filter(i => i.trim() !== s.trim())].slice(0, 8);
    setRecent(next);
    localStorage.setItem(LOCAL_RECENT_KEY, JSON.stringify(next));
  }, [recent]);
  const removeRecent = useCallback((s: string) => {
    const next = recent.filter(i => i !== s);
    setRecent(next);
    localStorage.setItem(LOCAL_RECENT_KEY, JSON.stringify(next));
  }, [recent]);

  // Use the smart search hook instead of custom logic
  const { 
    q: searchQuery, 
    setQ: setSearchQuery,
    filters,
    setFilters,
    results: searchResults,
    loading,
    error
  } = useSmartSearch('');

  const [showFilters, setShowFilters] = useState(false);

  // Sync URL params with search hook
  useEffect(() => {
    setSearchQuery(q);
  }, [q, setSearchQuery]);

  useEffect(() => {
    setFilters({
      category: cat !== 'All' ? cat : null,
      dateFrom: from || null,
      dateTo: to || null,
      onlyEvents: true, // Filter to events only at the source
    });
  }, [cat, from, to, setFilters]);

  // Keep only true events (ignore event_posts, orgs, etc.)
  const eventHits = useMemo(() => {
    return (searchResults || []).filter(r =>
      r.item_type === 'event' && r.item_id
    );
  }, [searchResults]);

  // Verify event pages exist & are public
  const [validEventIds, setValidEventIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = Array.from(new Set(
      eventHits.map(h => h.item_id).filter(Boolean)
    ));
    if (ids.length === 0) {
      setValidEventIds(new Set());
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, visibility')
        .in('id', ids);

      if (cancelled) return;
      if (error) {
        console.warn('verify events failed:', error);
        // fallback: allow all ids
        setValidEventIds(new Set(ids));
        return;
      }

      const allowed = new Set(
        (data || [])
          .filter(e => e.visibility === 'public')
          .map(e => e.id)
      );
      setValidEventIds(allowed);
    })();

    return () => { cancelled = true; };
  }, [eventHits]);

  // Transform verified events only
  const transformedResults = useMemo(() => {
    const rows = eventHits.filter(h => validEventIds.has(h.item_id));
    return rows.map(result => ({
      id: result.item_id,
      title: result.title,
      description: result.description || result.content || '',
      organizer: result.organizer_name || 'Organizer',
      organizerId: result.item_id,
      category: result.category || 'Other',
      date: result.start_at
        ? new Date(result.start_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'TBA',
      start_at: result.start_at,
      location: result.location || 'TBA',
      coverImage:
        result.cover_image_url ||
        'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=60',
      attendeeCount: undefined, // TODO: get real metrics
      priceFrom: undefined,     // TODO: get real pricing
      rating: 4.2,
      type: 'event',
      parentEventId: null,
    }));
  }, [eventHits, validEventIds]);

  // Client-side filtering for price (until server-side is implemented)
  const filteredResults = useMemo(() => {
    let filtered = [...transformedResults];

    if (min) filtered = filtered.filter(e => (e.priceFrom ?? 0) >= Number(min));
    if (max) filtered = filtered.filter(e => (e.priceFrom ?? 1e9) <= Number(max));
    
    // Sort
    filtered.sort((a, b) => {
      if (sort === 'price_asc') return (a.priceFrom ?? 1e9) - (b.priceFrom ?? 1e9);
      if (sort === 'price_desc') return (b.priceFrom ?? -1) - (a.priceFrom ?? -1);
      if (sort === 'attendees_desc') return (b.attendeeCount ?? 0) - (a.attendeeCount ?? 0);
      return 0; // date_asc default
    });
    
    return filtered;
  }, [transformedResults, min, max, sort]);

  const boostedResults = useMemo(() => {
    return (searchBoosts ?? [])
      .filter((row) => row && row.event_id)
      .map((row) => ({
        id: row.event_id,
        title: row.event_title ?? row.headline ?? 'Promoted Event',
        description: row.event_description ?? row.body_text ?? '',
        organizer: row.organizer_name ?? 'Organizer',
        organizerId: row.organizer_id ?? row.event_id,
        category: row.event_category ?? 'Other',
        date: row.event_starts_at
          ? new Date(row.event_starts_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : 'TBA',
        start_at: row.event_starts_at,
        location: row.event_location ?? row.event_city ?? 'TBA',
        coverImage:
          row.event_cover_image ??
          'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=60',
        attendeeCount: undefined,
        priceFrom: undefined,
        rating: 4.6,
        promotion: {
          placement: 'search_results' as const,
          campaignId: row.campaign_id,
          creativeId: row.creative_id,
          objective: row.objective,
          ctaLabel: row.cta_label,
          ctaUrl: row.cta_url,
          headline: row.headline,
          priority: row.priority ?? 0,
          frequencyCapPerUser: row.frequency_cap_per_user,
          frequencyCapPeriod: row.frequency_cap_period,
          targeting: row.targeting,
          rateModel: row.default_rate_model,
          cpmRateCredits: row.cpm_rate_credits,
          cpcRateCredits: row.cpc_rate_credits,
          remainingCredits: row.remaining_credits,
          dailyRemainingCredits: row.daily_remaining,
        },
      }));
  }, [searchBoosts]);

  const augmentedResults = useMemo(() => {
    const map = new Map<string, any>(filteredResults.map((event) => [event.id, { ...event }]));

    for (const promo of boostedResults) {
      if (!promo?.id) continue;
      const matchesCategory = cat === 'All' || !promo.category || promo.category === cat;
      if (!matchesCategory) continue;
      if (
        !canServeCampaign(
          promo.promotion.campaignId,
          promo.promotion.frequencyCapPerUser,
          promo.promotion.frequencyCapPeriod,
        )
      ) {
        continue;
      }

      if (map.has(promo.id)) {
        const existing = map.get(promo.id)!;
        existing.promotion = promo.promotion;
      } else {
        map.set(promo.id, promo);
      }
    }

    const combined = Array.from(map.values());
    const promoted = combined
      .filter((event) => event.promotion)
      .sort((a, b) => (b.promotion?.priority ?? 0) - (a.promotion?.priority ?? 0));
    const organic = combined.filter((event) => !event.promotion);
    return [...promoted, ...organic];
  }, [filteredResults, boostedResults, cat]);

  // Pagination
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const loggedPromotionsRef = useRef<Set<string>>(new Set());

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [augmentedResults]);

  // infinite scroll sentinel
  useEffect(() => {
    if (!loaderRef.current) return;
    const el = loaderRef.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setVisibleCount((c) => Math.min(c + PAGE_SIZE, augmentedResults.length));
      }
    }, { rootMargin: '600px' }); // prefetch before hitting bottom
    io.observe(el);
    return () => io.disconnect();
  }, [augmentedResults.length]);

  // helpers to update url params succinctly
  const setParam = (k: string, v?: string) => {
    const next = new URLSearchParams(params);
    if (v && v.length) next.set(k, v); else next.delete(k);

    // analytics (use safe access to avoid undefined reference)
    trackEvent('search_filter_change', {
      filter_type: k,
      filter_value: v || '',
      query: q,
      category: cat,
      results_count: augmentedResults?.length || 0
    });

    // recent searches (when editing the main query)
    if (k === 'q' && v !== undefined) {
      // push after small debounce
      window.setTimeout(() => pushRecent(v), 50);
    }

    setParams(next, { replace: true });
  };

  const clearAll = () => {
    trackEvent('search_filters_clear', {
      previous_query: q,
      previous_category: cat,
      results_count: augmentedResults?.length || 0
    });
    setParams(new URLSearchParams(), { replace: true });
    setVisibleCount(PAGE_SIZE);
  };

  // quick chips
  const setTonight = () => {
    const now = new Date();
    const midnight = new Date(now); midnight.setHours(23,59,59,999);
    setParam('from', now.toISOString());
    setParam('to', midnight.toISOString());
  };
  const setWeekend = () => {
    const sat = nextSaturday(new Date());
    const sun = nextSunday(new Date(sat));
    const end = new Date(sun); end.setHours(23,59,59,999);
    setParam('from', sat.toISOString());
    setParam('to', end.toISOString());
  };
  const set30d = () => {
    const now = new Date();
    const in30 = new Date(now); in30.setDate(now.getDate() + 30);
    setParam('from', now.toISOString());
    setParam('to', in30.toISOString());
  };

  const handleRecommendationClick = (eventId: string) => {
    trackInteraction(eventId, 'event_view');
    onEventSelect(eventId);
  };

  const handleRecommendationTicketClick = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    trackInteraction(eventId, 'ticket_open');
    onEventSelect(eventId);
  };

  const handleResultClick = useCallback((event: any) => {
    if (event?.promotion) {
      void logAdClick(
        {
          campaignId: event.promotion.campaignId,
          creativeId: event.promotion.creativeId ?? null,
          eventId: event.id,
          placement: 'search_results',
        },
        { userId: user?.id ?? null },
      ).catch(() => undefined);
    }
    trackInteraction(event.id, 'event_view');
    onEventSelect(event.id);
  }, [onEventSelect, trackInteraction, user?.id]);

  const handleResultTicketClick = useCallback((event: any, eventId?: string) => {
    if (event?.promotion) {
      void logAdClick(
        {
          campaignId: event.promotion.campaignId,
          creativeId: event.promotion.creativeId ?? null,
          eventId: event.id,
          placement: 'search_results',
        },
        { userId: user?.id ?? null },
      ).catch(() => undefined);
      if (event.promotion.ctaUrl) {
        try {
          window.open(event.promotion.ctaUrl, '_blank', 'noopener');
        } catch (err) {
          console.warn('[search] failed to open CTA url', err);
        }
      }
    }
    trackInteraction(event.id, 'ticket_open');
    onEventSelect(eventId ?? event.id);
  }, [onEventSelect, trackInteraction, user?.id]);

  // keyboard shortcut: open focus on query ("/")
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && !(e.target as HTMLElement).isContentEditable) {
          e.preventDefault();
          const input = document.getElementById('search-query-input') as HTMLInputElement | null;
          input?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ————————————————————————————————————————
  // Render
  // ————————————————————————————————————————
  const visible = augmentedResults.slice(0, visibleCount);

  useEffect(() => {
    visible.forEach((event) => {
      if (!event?.promotion) return;
      const key = `${event.promotion.campaignId}:${event.promotion.creativeId ?? event.id}`;
      if (loggedPromotionsRef.current.has(key)) return;

      void logAdImpression(
        {
          campaignId: event.promotion.campaignId,
          creativeId: event.promotion.creativeId ?? null,
          eventId: event.id,
          placement: 'search_results',
        },
        {
          userId: user?.id ?? null,
          frequencyCap: {
            cap: event.promotion.frequencyCapPerUser,
            period: event.promotion.frequencyCapPeriod,
          },
        },
      ).catch(() => undefined);

      loggedPromotionsRef.current.add(key);
    });
  }, [visible, user?.id]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <Search className="w-6 h-6 text-muted-foreground" />
              <div>
                <h1 className="text-xl font-semibold truncate">Search Events</h1>
                <p className="text-sm text-muted-foreground">Discover amazing events near you</p>
              </div>
            </div>
          </div>

          {/* Search / controls */}
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search-query-input"
                value={q}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Search events, organizers, locations… (press / to focus)"
                className="pl-10"
              />
            </div>

            <Input
              value={city}
              onChange={(e) => setParam('city', e.target.value)}
              placeholder="City"
              className="w-[180px]"
            />

            <Select value={sort} onValueChange={(v) => setParam('sort', v)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_asc">Sort by date</SelectItem>
                <SelectItem value="price_asc">Price: Low → High</SelectItem>
                <SelectItem value="price_desc">Price: High → Low</SelectItem>
                <SelectItem value="attendees_desc">Most popular</SelectItem>
              </SelectContent>
            </Select>

            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline"><SlidersHorizontal className="w-4 h-4 mr-2" />Filters</Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="end">
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Filters</h3>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-2 text-muted-foreground">Clear all</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)} className="h-8 w-8 p-0"><X className="w-4 h-4"/></Button>
                    </div>
                  </div>

                  {/* Quick date chips */}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={setTonight}>Tonight</Button>
                    <Button variant="secondary" size="sm" onClick={setWeekend}>This weekend</Button>
                    <Button variant="secondary" size="sm" onClick={set30d}>Next 30 days</Button>
                  </div>

                  {/* Price */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Min price ($)</label>
                      <Input inputMode="numeric" value={min} onChange={(e)=>setParam('min', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Max price ($)</label>
                      <Input inputMode="numeric" value={max} onChange={(e)=>setParam('max', e.target.value)} placeholder="Any" />
                    </div>
                  </div>

                  {/* Date range */}
                  <div className="grid grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('justify-start', !from && 'text-muted-foreground')}>
                          <CalendarIcon className="w-4 h-4 mr-2"/> {from ? format(new Date(from), 'MMM dd, yyyy') : 'From'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={from ? new Date(from) : undefined} onSelect={(d)=> setParam('from', d ? d.toISOString() : undefined)} className="p-2" />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('justify-start', !to && 'text-muted-foreground')}>
                          <CalendarIcon className="w-4 h-4 mr-2"/> {to ? format(new Date(to), 'MMM dd, yyyy') : 'To'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={to ? new Date(to) : undefined} onSelect={(d)=> setParam('to', d ? d.toISOString() : undefined)} className="p-2" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Categories */}
          <div className="mt-3 overflow-x-auto">
            <div className="flex gap-2 min-w-max pb-2">
              {categories.map((c) => (
                <Button
                  key={c}
                  variant={cat === c ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full"
                  onClick={()=> setParam('cat', cat === c ? 'All' : c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          </div>

          {/* Active chips */}
          {(q || city || min || max || from || to || (cat !== 'All')) && (
            <div className="flex flex-wrap gap-2 pt-2">
              {cat !== 'All' && <FilterChip label={`Category: ${cat}`} onClear={()=>setParam('cat','All')} />}
              {q && <FilterChip label={`"${q}"`} onClear={()=>setParam('q')} />}
              {city && <FilterChip label={`City: ${city}`} onClear={()=>setParam('city')} />}
              {min && <FilterChip label={`Min $${min}`} onClear={()=>setParam('min')} />}
              {max && <FilterChip label={`Max $${max}`} onClear={()=>setParam('max')} />}
              {from && <FilterChip label={`From ${format(new Date(from),'MMM dd')}`} onClear={()=>setParam('from')} />}
              {to && <FilterChip label={`To ${format(new Date(to),'MMM dd')}`} onClear={()=>setParam('to')} />}
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-8">Reset</Button>
            </div>
          )}

          {/* Recent searches */}
          {!q && recent.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">Recent searches</div>
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    className="px-2 py-1 rounded bg-muted text-foreground/90 hover:bg-muted/80 text-xs"
                    onClick={() => setParam('q', r)}
                    aria-label={`Use recent search ${r}`}
                  >
                    {r}
                    <span
                      className="ml-2 text-foreground/60 hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); removeRecent(r); }}
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {/* For You Recommendations Section */}
          {user && !recLoading && recommendations.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">For you</h2>
                <span className="text-sm text-muted-foreground">Based on your activity</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {recommendations.slice(0, 6).map(rec => {
                  const eventForCard = {
                    id: rec.event_id,
                    title: rec.title,
                    description: rec.description || `Join this ${rec.category || 'event'} and connect with others`,
                    category: rec.category,
                    start_at: rec.starts_at,
                    date: rec.starts_at,
                    location: rec.venue || (rec.distance_km ? `${rec.distance_km.toFixed(1)} km away` : 'Location TBD'),
                    distance_km: rec.distance_km,
                    coverImage: rec.cover_image_url || `/images/placeholders/event-cover-fallback.jpg`,
                    priceFrom: rec.min_price || undefined, // Use actual pricing data
                    rating: 4.2,
                    attendeeCount: undefined // Don't show attending count as requested
                  };

                  return (
                    <EventCard
                      key={rec.event_id}
                      event={eventForCard}
                      onClick={() => handleRecommendationClick(rec.event_id)}
                      onTicket={(eventId) => {
                        const e = new Event('click') as any;
                        e.stopPropagation = () => {};
                        handleRecommendationTicketClick(eventId, e);
                      }}
                      className="border-2 border-primary/20 hover:border-primary/40"
                    />
                  );
                })}
              </div>
              <div className="border-t mt-6 pt-6 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-xl font-semibold">All Events</h2>
              </div>
            </div>
          )}

          {loading ? (
            <SkeletonGrid />
          ) : augmentedResults.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                {visible.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    onClick={() => handleResultClick(e)}
                    onTicket={(eventId) => handleResultTicketClick(e, eventId)}
                  />
                ))}
              </div>
              {/* sentinel for infinite scroll */}
              {visibleCount < augmentedResults.length && (
                <div ref={loaderRef} className="h-12 flex items-center justify-center text-muted-foreground">
                  Loading more…
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
