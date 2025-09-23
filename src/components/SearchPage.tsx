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
import { useSmartSearch } from '@/hooks/useSmartSearch';
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

  // Use the smart search hook
  const { 
    results: searchResults, 
    loading: searchLoading, 
    error: searchError, 
    setQ: setSearchQuery, 
    setFilters 
  } = useSmartSearch(q);

  // Update search filters when URL params change
  useEffect(() => {
    setSearchQuery(q);
    setFilters({
      category: cat === 'All' ? null : cat,
      dateFrom: from || null,
      dateTo: to || null,
      onlyEvents: false
    });
  }, [q, cat, from, to, setSearchQuery, setFilters]);

  // data state  
  const [showFilters, setShowFilters] = useState(false);

  // Transform search results to match the expected format
  const results = useMemo(() => {
    return searchResults.map((item) => ({
      id: item.item_id,
      title: item.title,
      description: item.description || item.content || '',
      organizer: item.organizer_name || 'Organizer',
      organizerId: item.parent_event_id || item.item_id, // Use parent_event_id for posts, item_id for events
      category: item.category || 'Other',
      date: item.start_at ? new Date(item.start_at).toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      }) : 'TBA',
      start_at: item.start_at,
      location: item.location || 'TBA',
      cover_image_url: item.cover_image_url,
      attendeeCount: 0, // Real data - no fake numbers
      priceFrom: 0,     // Real data - no fake numbers
      rating: 0,        // Real data - no fake numbers
      sponsor: null,    // Could be added from search results if needed
      item_type: item.item_type, // 'event' or 'post'
      parent_event_id: item.parent_event_id,
    }));
  }, [searchResults]);

  // Apply client-side filters (price filtering since search hook doesn't support it yet)
  const filteredResults = useMemo(() => {
    let filtered = [...results];

    // Price filters (client side since search doesn't support price yet)
    if (min) filtered = filtered.filter(e => (e.priceFrom ?? 0) >= Number(min));
    if (max) filtered = filtered.filter(e => (e.priceFrom ?? 1e9) <= Number(max));

    // Sort
    filtered.sort((a, b) => {
      if (sort === 'price_asc') return (a.priceFrom ?? 1e9) - (b.priceFrom ?? 1e9);
      if (sort === 'price_desc') return (b.priceFrom ?? -1) - (a.priceFrom ?? -1);
      if (sort === 'attendees_desc') return (b.attendeeCount ?? 0) - (a.attendeeCount ?? 0);
      // date_asc default; server already ordered
      return 0;
    });

    return filtered;
  }, [results, sort, min, max]);

  // Paging for display
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement | null>(null);

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

  // infinite scroll sentinel
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && visibleCount < filteredResults.length) {
        setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredResults.length));
      }
    });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [visibleCount, filteredResults.length]);

  // track search
  useEffect(() => {
    if (q) {
      trackEvent('search_query', { query: q, category: cat, location: city });
      pushRecent(q);
    }
  }, [q, cat, city, trackEvent, pushRecent]);

  const setParam = useCallback((key: string, value: string) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }, [setParams]);

  const clearAll = useCallback(() => {
    setParams(new URLSearchParams());
  }, [setParams]);

  const setTonight = useCallback(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    setParam('from', today.toISOString().split('T')[0]);
    setParam('to', tomorrow.toISOString().split('T')[0]);
  }, [setParam]);

  const setWeekend = useCallback(() => {
    const sat = nextSaturday(new Date());
    const sun = nextSunday(sat);
    setParam('from', sat.toISOString().split('T')[0]);
    setParam('to', sun.toISOString().split('T')[0]);
  }, [setParam]);

  const set30d = useCallback(() => {
    const today = new Date();
    const future = new Date(today);
    future.setDate(today.getDate() + 30);
    setParam('from', today.toISOString().split('T')[0]);
    setParam('to', future.toISOString().split('T')[0]);
  }, [setParam]);

  const activeFilters = useMemo(() => {
    const filters = [];
    if (cat !== 'All') filters.push({ key: 'cat', label: cat, clear: () => setParam('cat', '') });
    if (city) filters.push({ key: 'city', label: `📍 ${city}`, clear: () => setParam('city', '') });
    if (min) filters.push({ key: 'min', label: `Min $${min}`, clear: () => setParam('min', '') });
    if (max) filters.push({ key: 'max', label: `Max $${max}`, clear: () => setParam('max', '') });
    if (from && to) {
      const fromD = new Date(from);
      const toD = new Date(to);
      if (isSameDay(fromD, toD)) {
        filters.push({ key: 'date', label: `📅 ${format(fromD, 'MMM d')}`, clear: () => { setParam('from', ''); setParam('to', ''); } });
      } else {
        filters.push({ key: 'date', label: `📅 ${format(fromD, 'MMM d')} - ${format(toD, 'MMM d')}`, clear: () => { setParam('from', ''); setParam('to', ''); } });
      }
    } else if (from) {
      filters.push({ key: 'from', label: `📅 From ${format(new Date(from), 'MMM d')}`, clear: () => setParam('from', '') });
    } else if (to) {
      filters.push({ key: 'to', label: `📅 Until ${format(new Date(to), 'MMM d')}`, clear: () => setParam('to', '') });
    }
    return filters;
  }, [cat, city, min, max, from, to, setParam]);

  // visible results
  const visibleResults = filteredResults.slice(0, visibleCount);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex-none p-4 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-input"
              placeholder="Search events..."
              className="pl-10 pr-10 h-11"
              value={q}
              onChange={(e) => setParam('q', e.target.value)}
            />
            {q && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                onClick={() => setParam('q', '')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="City"
              className="w-32 h-11"
              value={city}
              onChange={(e) => setParam('city', e.target.value)}
            />
            <Select value={sort} onValueChange={(v) => setParam('sort', v)}>
              <SelectTrigger className="w-32 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_asc">Date ↑</SelectItem>
                <SelectItem value="price_asc">Price ↑</SelectItem>
                <SelectItem value="price_desc">Price ↓</SelectItem>
                <SelectItem value="attendees_desc">Popular</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Price Range</label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Min"
                        type="number"
                        value={min}
                        onChange={(e) => setParam('min', e.target.value)}
                      />
                      <Input
                        placeholder="Max"
                        type="number"
                        value={max}
                        onChange={(e) => setParam('max', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Date Range</label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="date"
                        value={from}
                        onChange={(e) => setParam('from', e.target.value)}
                      />
                      <Input
                        type="date"
                        value={to}
                        onChange={(e) => setParam('to', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Category Selection */}
        <div className="mt-4 max-w-4xl mx-auto">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((category) => (
              <Button
                key={category}
                variant={cat === category ? 'default' : 'outline'}
                size="sm"
                className="whitespace-nowrap"
                onClick={() => setParam('cat', category === 'All' ? '' : category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="mt-3 max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <FilterChip
                  key={filter.key}
                  label={filter.label}
                  onClear={filter.clear}
                />
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs h-8"
              >
                Clear all
              </Button>
            </div>
          </div>
        )}

        {/* Quick Filters */}
        <div className="mt-3 max-w-4xl mx-auto">
          <div className="flex gap-2 text-sm">
            <Button variant="ghost" size="sm" onClick={setTonight}>
              Tonight
            </Button>
            <Button variant="ghost" size="sm" onClick={set30d}>
              Next 30 days
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear filters
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-4">
          {/* For You Section */}
          {user && recommendations && recommendations.length > 0 && !q && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">For you</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recommendations.slice(0, 6).map((event) => (
                  <EventCard
                    key={event.event_id}
                    event={{
                      ...event,
                      id: event.event_id,
                      start_at: event.starts_at,
                    }}
                    onClick={() => onEventSelect(event.event_id)}
                    onTicket={() => onEventSelect(event.event_id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {searchLoading ? (
            <SkeletonGrid rows={6} showHeaderStub={q.length > 0} />
          ) : visibleResults.length > 0 ? (
            <>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} 
                  {q && ` for "${q}"`}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleResults.map((item) => (
                  <EventCard
                    key={`${item.item_type}-${item.id}`}
                    event={item}
                    onClick={() => onEventSelect(item.organizerId)}
                    onTicket={() => onEventSelect(item.organizerId)}
                  />
                ))}
              </div>
              {visibleCount < filteredResults.length && (
                <div ref={loaderRef} className="h-20 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              )}
            </>
          ) : (
            <EmptyState 
              title={q ? 'No events found' : 'Start searching'}
              subtitle={q ? 'Try different keywords or remove filters.' : 'Search for events by name, location, or category.'}
              onReset={clearAll}
            />
          )}
        </div>
      </div>
    </div>
  );
}