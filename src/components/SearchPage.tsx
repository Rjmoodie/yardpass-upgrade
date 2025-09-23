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

  // data state
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // paging (client-side for now; easy to migrate to server pages)
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // fetch (server-side filtering where possible)
  useEffect(() => {
    let canceled = false;

    const load = async () => {
      setLoading(true);
      try {
        const qb = supabase
          .from('events')
          .select(`
            id,
            title,
            description,
            start_at,
            end_at,
            venue,
            city,
            category,
            cover_image_url,
            visibility,
            user_profiles!events_created_by_fkey (
              display_name
            ),
            event_sponsorships!inner (
              sponsor_id,
              tier,
              status,
              sponsors (
                name,
                logo_url
              )
            )
          `)
          .eq('visibility', 'public')
          .eq('event_sponsorships.status', 'active');

        // server filters (safe)
        if (q) {
          // Use ilike on title/desc/city where possible (cheap-ish)
          qb.or(`title.ilike.%${q}%,description.ilike.%${q}%,city.ilike.%${q}%`);
        }
        if (city) qb.ilike('city', `%${city}%`);
        if (from) qb.gte('start_at', from);
        if (to) qb.lte('start_at', to);

        qb.order('start_at', { ascending: true }).limit(200);

        const { data, error } = await qb;
        if (error) throw error;

        const transformed = (data || []).map((e: any) => ({
          id: e.id,
          title: e.title,
          description: e.description || '',
          organizer: e.user_profiles?.display_name || 'Organizer',
          organizerId: e.id,
          category: e.category || 'Other',
          date: new Date(e.start_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          start_at: e.start_at,
          location: e.city || e.venue || 'TBA',
          coverImage: e.cover_image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=60',
          attendeeCount: Math.floor(Math.random()*900)+50, // replace with real metric when available
          priceFrom: Math.floor(Math.random()*100)+15,     // replace with real price once added to schema
          rating: 4 + Math.random(),
          // Extract primary sponsor information
          sponsor: e.event_sponsorships?.[0]?.sponsors ? {
            name: e.event_sponsorships[0].sponsors.name,
            logo_url: e.event_sponsorships[0].sponsors.logo_url,
            tier: e.event_sponsorships[0].tier
          } : null,
        }));

        if (!canceled) {
          const fallback = transformed.length ? transformed : mockSearchResults;
          setAllEvents(fallback);
        }
      } catch (e) {
        console.error('search load error', e);
        if (!canceled) setAllEvents(mockSearchResults);
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    load();
    return () => { canceled = true; };
  }, [q, city, from, to]);

  // apply filters + debounce on url param change
  useEffect(() => {
    const t = setTimeout(() => {
      let filtered = [...allEvents];

      if (cat !== 'All') filtered = filtered.filter(e => e.category === cat);

      // price filters (client side until price exists server-side)
      if (min) filtered = filtered.filter(e => (e.priceFrom ?? 0) >= Number(min));
      if (max) filtered = filtered.filter(e => (e.priceFrom ?? 1e9) <= Number(max));

      // from/to already applied on server; keep guard (for mock data)
      if (from || to) {
        const fromD = from ? new Date(from) : null;
        const toD = to ? new Date(to) : null;
        filtered = filtered.filter(e => {
          const d = new Date(e.date);
          const okFrom = fromD ? d >= fromD : true;
          const okTo = toD ? d <= toD : true;
          return okFrom && okTo;
        });
      }

      // sort
      filtered.sort((a, b) => {
        if (sort === 'price_asc') return (a.priceFrom ?? 1e9) - (b.priceFrom ?? 1e9);
        if (sort === 'price_desc') return (b.priceFrom ?? -1) - (a.priceFrom ?? -1);
        if (sort === 'attendees_desc') return (b.attendeeCount ?? 0) - (a.attendeeCount ?? 0);
        // date_asc default; server already ordered
        return 0;
      });

      setResults(filtered);
      setVisibleCount(PAGE_SIZE); // reset paging on filter change
    }, 150);
    return () => clearTimeout(t);
  }, [allEvents, cat, sort, min, max, from, to]);

  // infinite scroll sentinel
  useEffect(() => {
    if (!loaderRef.current) return;
    const el = loaderRef.current;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setVisibleCount((c) => Math.min(c + PAGE_SIZE, results.length));
      }
    }, { rootMargin: '600px' }); // prefetch before hitting bottom
    io.observe(el);
    return () => io.disconnect();
  }, [results.length]);

  // helpers to update url params succinctly
  const setParam = (k: string, v?: string) => {
    const next = new URLSearchParams(params);
    if (v && v.length) next.set(k, v); else next.delete(k);

    // analytics
    trackEvent('search_filter_change', {
      filter_type: k,
      filter_value: v || '',
      query: q,
      category: cat,
      results_count: results.length
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
      results_count: results.length
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
  const visible = results.slice(0, visibleCount);

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
          ) : results.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                {visible.map((e) => (
                  <EventCard key={e.id} event={e} onClick={() => onEventSelect?.(e.id)} />
                ))}
              </div>
              {/* sentinel for infinite scroll */}
              {visibleCount < results.length && (
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
