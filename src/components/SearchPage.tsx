// SearchPage with consolidated filter modal
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Search,
  X,
  SlidersHorizontal,
  Calendar as CalendarIcon,
  Sparkles,
  MapPin,
  LocateFixed,
  History,
} from 'lucide-react';
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
import { FollowButton } from '@/components/follow/FollowButton';
import { MessageButton } from '@/components/messaging/MessageButton';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface SearchPageProps {
  onBack: () => void;
  onEventSelect: (eventId: string) => void;
}

const categories = [
  'All',
  'Music',
  'Food & Drink',
  'Art & Culture',
  'Sports & Fitness',
  'Business & Professional',
  'Network',
  'Technology',
  'Other'
];

const quickSearchPresets = [
  { label: 'Live music tonight', value: 'live music' },
  { label: 'Networking mixers', value: 'networking' },
  { label: 'Pop-up dining', value: 'food festival' },
  { label: 'Outdoor fitness', value: 'fitness class' },
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

const LOCATION_UNKNOWN = 'Location TBD';
const EARTH_RADIUS_KM = 6371;

type LocationDetails = {
  full: string;
  short: string;
  display: string;
  city: string | null;
  state: string | null;
  country: string | null;
  isVirtual: boolean;
  keywords: string[];
};

type UserSearchResult = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  role: string | null;
  verification_status: string | null;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export default function SearchPage({ onBack, onEventSelect }: SearchPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Extract search parameters
  const q = searchParams.get('q') || '';
  const city = searchParams.get('city') || '';
  const category = searchParams.get('category') || 'All';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const sort = searchParams.get('sort') || 'relevance';
  const min = searchParams.get('min') || '';
  const max = searchParams.get('max') || '';
  
  // UI state
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  
  // Popular location suggestions
  const locationSuggestions = useMemo(() => [
    { label: 'New York, NY', count: 245 },
    { label: 'Los Angeles, CA', count: 189 },
    { label: 'Chicago, IL', count: 156 },
    { label: 'Miami, FL', count: 142 },
    { label: 'Austin, TX', count: 128 },
    { label: 'Seattle, WA', count: 115 },
  ], []);
  
  // Location state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocationLabel, setUserLocationLabel] = useState<string>('');
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string>('');
  
  // Recent searches
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('search_recent') || '[]');
    } catch {
      return [];
    }
  });
  
  // Search results state
  const includeUsersParam = searchParams.get('includeUsers') === '1';
  const [includeUsers, setIncludeUsers] = useState(includeUsersParam);
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [displayedResults, setDisplayedResults] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [heroEvent, setHeroEvent] = useState<any>(null);
  const [heroSubtitle, setHeroSubtitle] = useState<string>('');
  
  const loaderRef = useRef<HTMLDivElement>(null);
  
  // Helper function to set URL parameters
  const setParam = useCallback((key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  const toggleIncludeUsers = useCallback((checked: boolean) => {
    setIncludeUsers(checked);
    setParam('includeUsers', checked ? '1' : '');
  }, [setParam]);

  useEffect(() => {
    setIncludeUsers(includeUsersParam);
  }, [includeUsersParam]);

  useEffect(() => {
    if (!includeUsers) {
      setUserResults([]);
      setUserLoading(false);
      return;
    }
    if (!q.trim()) {
      setUserResults([]);
      setUserLoading(false);
      return;
    }

    let cancelled = false;
    setUserLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('user_id,display_name,photo_url,role,verification_status')
          .ilike('display_name', `%${q}%`)
          .order('display_name', { ascending: true })
          .limit(12);

        if (error) throw error;
        if (!cancelled) {
          setUserResults((data ?? []) as UserSearchResult[]);
        }
      } catch (err) {
        console.error('User search failed', err);
        if (!cancelled) {
          setUserResults([]);
        }
      } finally {
        if (!cancelled) {
          setUserLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [includeUsers, q]);
  
  // Clear all filters
  const clearAll = useCallback(() => {
    setSearchParams({});
    setDisplayedResults([]);
    setVisibleCount(12);
    setHasMore(true);
    setIsStale(false);
    setLastUpdatedAt(null);
    setHeroEvent(null);
    setHeroSubtitle('');
  }, [setSearchParams]);
  
  // Recent searches management
  const addRecent = useCallback((term: string) => {
    if (!term.trim()) return;
    setRecent(prev => {
      const updated = [term, ...prev.filter(t => t !== term)].slice(0, 5);
      localStorage.setItem('search_recent', JSON.stringify(updated));
      return updated;
    });
  }, []);
  
  const clearRecent = useCallback(() => {
    setRecent([]);
    localStorage.removeItem('search_recent');
  }, []);
  
  const removeRecent = useCallback((term: string) => {
    setRecent(prev => {
      const updated = prev.filter(t => t !== term);
      localStorage.setItem('search_recent', JSON.stringify(updated));
      return updated;
    });
  }, []);
  
  // Location handling
  const requestCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }
    
    setIsLocating(true);
    setLocationError('');
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });
      
      const { latitude, longitude } = position.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      
      // Reverse geocode to get city name
      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        );
        const data = await response.json();
        const cityName = data.city || data.locality || data.principalSubdivision || 'Unknown';
        setUserLocationLabel(`${cityName}`);
        setParam('city', cityName);
      } catch (geoError) {
        console.warn('Reverse geocoding failed:', geoError);
        setUserLocationLabel(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
    } catch (error: any) {
      console.error('Geolocation error:', error);
      setLocationError(error.message || 'Failed to get location');
    } finally {
      setIsLocating(false);
    }
  }, [setParam]);
  
  // Quick date range functions
  const setTonight = useCallback(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(23, 59, 59, 999);
    setParam('from', now.toISOString());
    setParam('to', midnight.toISOString());
  }, [setParam]);
  
  const setWeekend = useCallback(() => {
    const saturday = nextSaturday(new Date());
    const sunday = nextSunday(saturday);
    const endOfSunday = new Date(sunday);
    endOfSunday.setHours(23, 59, 59, 999);
    setParam('from', saturday.toISOString());
    setParam('to', endOfSunday.toISOString());
  }, [setParam]);
  
  const set30d = useCallback(() => {
    const now = new Date();
    const in30 = new Date(now);
    in30.setDate(now.getDate() + 30);
    setParam('from', now.toISOString());
    setParam('to', in30.toISOString());
  }, [setParam]);
  
  // Use the actual smart search hook
  const {
    results: searchResults,
    loading: searchLoading,
    hasMore: searchHasMore,
    loadMore: searchLoadMore,
    isStale: searchIsStale,
    lastUpdatedAt: searchLastUpdated,
    error: searchError
  } = useSmartSearch({
    query: q,
    location: city,
    category: category !== 'All' ? category : undefined,
    dateFrom: from || undefined,
    dateTo: to || undefined,
    limit: 20
  });
  
  // Filter search results to only show events (not posts)
  const eventResults = useMemo(() => {
    return searchResults.filter(result => result.item_type === 'event');
  }, [searchResults]);

  // Update local state when search results change
  useEffect(() => {
    if (eventResults.length > 0) {
      setDisplayedResults(eventResults);
      setHasMore(searchHasMore);
      setIsStale(searchIsStale);
      setLastUpdatedAt(searchLastUpdated);
      
      // Set hero event (first result)
      setHeroEvent(eventResults[0]);
      setHeroSubtitle(q.trim() ? 'Featured match' : 'Trending now');
      
      // Add to recent searches
      if (q.trim()) {
        addRecent(q);
      }
    } else if (!searchLoading) {
      setDisplayedResults([]);
      setHeroEvent(null);
      setHeroSubtitle('');
    }
  }, [eventResults, searchHasMore, searchIsStale, searchLastUpdated, q, addRecent, searchLoading]);
  
  // Update loading states
  useEffect(() => {
    setIsInitialLoading(searchLoading && displayedResults.length === 0);
    setLoading(searchLoading);
  }, [searchLoading, displayedResults.length]);
  
  // Get personalized recommendations
  const { user } = useAuth();
  const { data: recommendations, loading: recLoading } = useRecommendations(user?.id, 6);
  
  // Prepare recommendations for rendering
  const recommendationsToRender = useMemo(() => {
    if (!recommendations || recommendations.length === 0) return [];
    
    return recommendations.slice(0, 6).map(rec => ({
      eventId: rec.event_id,
      event: {
        id: rec.event_id,
        title: rec.title,
        category: rec.category,
        start_at: rec.starts_at,
        cover_image_url: rec.cover_image_url,
        description: rec.description,
        location: rec.venue,
        min_price: rec.min_price,
      }
    }));
  }, [recommendations]);
  
  const recommendationsLabel = useMemo(() => {
    if (q) return 'You might also like';
    return 'Recommended for you';
  }, [q]);
  
  // Recommendation handlers
  const handleRecommendationClick = useCallback((eventId: string) => {
    onEventSelect(eventId);
  }, [onEventSelect]);
  
  const handleRecommendationTicketClick = useCallback((eventId: string) => {
    // Navigate to event details page when ticket button is clicked
    onEventSelect(eventId);
  }, [onEventSelect]);
  
  // Hero event handlers
  const handleHeroClick = useCallback(() => {
    if (heroEvent?.id) {
      onEventSelect(heroEvent.id);
    }
  }, [heroEvent, onEventSelect]);
  
  const heroTicketHandler = useCallback((eventId: string) => {
    // Navigate to event details page when ticket button is clicked
    onEventSelect(eventId);
  }, [onEventSelect]);
  
  // Load more results
  const loadMore = useCallback(() => {
    if (searchHasMore) {
      searchLoadMore();
    } else {
      setVisibleCount(prev => Math.min(prev + 12, displayedResults.length));
    }
  }, [searchHasMore, searchLoadMore, displayedResults.length]);
  
  // Event handlers
  const handleResultClick = useCallback((event: any) => {
    const eventId = event.item_id || event.id;
    if (eventId) onEventSelect(eventId);
  }, [onEventSelect]);
  
  const handleResultTicketClick = useCallback((event: any, eventId: string) => {
    // Navigate to event details page when ticket button is clicked
    onEventSelect(eventId);
  }, [onEventSelect]);
  
  // Computed values
  const visible = displayedResults.slice(0, visibleCount);
  const resultsSummary = displayedResults.length > 0 
    ? `${displayedResults.length} event${displayedResults.length === 1 ? '' : 's'} found`
    : 'No events found';
  
  // Error handling
  const error = searchError;
  const retry = useCallback(() => {
    window.location.reload();
  }, []);
  
  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && (searchHasMore || visibleCount < displayedResults.length) && !searchLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    
    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
    
    return () => observer.disconnect();
  }, [searchHasMore, visibleCount, displayedResults.length, searchLoading, loadMore]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && e.target !== document.activeElement) {
        e.preventDefault();
        const input = document.getElementById('search-query-input') as HTMLInputElement;
        input?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; onClear: () => void }[] = [];

    if (category !== 'All') {
      filters.push({
        key: 'category',
        label: `Category: ${category}`,
        onClear: () => setParam('category', 'All'),
      });
    }

    if (q) {
      filters.push({
        key: 'query',
        label: `"${q}"`,
        onClear: () => setParam('q', ''),
      });
    }

    if (city) {
      filters.push({
        key: 'city',
        label: `City: ${city}`,
        onClear: () => setParam('city', ''),
      });
    }

    if (min) {
      filters.push({
        key: 'min',
        label: `Min $${min}`,
        onClear: () => setParam('min', ''),
      });
    }

    if (max) {
      filters.push({
        key: 'max',
        label: `Max $${max}`,
        onClear: () => setParam('max', ''),
      });
    }

    if (from) {
      filters.push({
        key: 'from',
        label: `From ${format(new Date(from), 'MMM dd')}`,
        onClear: () => setParam('from', ''),
      });
    }

    if (to) {
      filters.push({
        key: 'to',
        label: `To ${format(new Date(to), 'MMM dd')}`,
        onClear: () => setParam('to', ''),
      });
    }

    return filters;
  }, [category, q, city, min, max, from, to, setParam]);

  const filtersAppliedCount = activeFilters.length;

  const FilterForm = ({ withFooter = false }: { withFooter?: boolean }) => (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Location</h3>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={city}
                onChange={(e) => setParam('city', e.target.value)}
                placeholder="City or virtual"
                className="h-12 rounded-2xl border-slate-200 pl-11"
              />
            </div>
            <Button
              variant="outline"
              className="h-12 rounded-2xl px-4"
              onClick={requestCurrentLocation}
              disabled={isLocating}
            >
              <LocateFixed className="mr-2 h-4 w-4" />
              {isLocating ? 'Locating…' : 'Near me'}
            </Button>
          </div>
          {userLocationLabel && (
            <p className="text-xs text-slate-500">Using {userLocationLabel}</p>
          )}
          {locationError && <p className="text-xs text-rose-500">{locationError}</p>}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-600">Popular locations</p>
          <div className="flex flex-wrap gap-2">
            {locationSuggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => setParam('city', suggestion.label)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>{suggestion.label}</span>
                <span className="text-xs text-slate-400">{suggestion.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Date range</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('mt-2 h-12 w-full justify-start rounded-2xl text-left', !from && 'text-slate-400')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {from ? format(new Date(from), 'MMM dd, yyyy') : 'Any date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={from ? new Date(from) : undefined}
                  onSelect={(date) => setParam('from', date ? date.toISOString() : '')}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('mt-2 h-12 w-full justify-start rounded-2xl text-left', !to && 'text-slate-400')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {to ? format(new Date(to), 'MMM dd, yyyy') : 'Any date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={to ? new Date(to) : undefined}
                  onSelect={(date) => setParam('to', date ? date.toISOString() : '')}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={setTonight} className="rounded-full">
            Tonight
          </Button>
          <Button variant="outline" size="sm" onClick={setWeekend} className="rounded-full">
            This weekend
          </Button>
          <Button variant="outline" size="sm" onClick={set30d} className="rounded-full">
            Next 30 days
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">Category</h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Button
              key={c}
              variant={category === c ? 'default' : 'outline'}
              size="sm"
              className="rounded-full"
              onClick={() => setParam('category', category === c ? 'All' : c)}
            >
              {c}
            </Button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Price range</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Min price ($)</label>
              <Input
                inputMode="numeric"
                value={min}
                onChange={(e) => setParam('min', e.target.value)}
                placeholder="0"
                className="mt-2 h-10 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Max price ($)</label>
              <Input
                inputMode="numeric"
                value={max}
                onChange={(e) => setParam('max', e.target.value)}
                placeholder="Any"
                className="mt-2 h-10 rounded-xl"
              />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Sort by</h3>
          <Select value={sort} onValueChange={(v) => setParam('sort', v)}>
            <SelectTrigger className="h-12 rounded-2xl">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Best match</SelectItem>
              <SelectItem value="date_asc">Soonest first</SelectItem>
              <SelectItem value="price_asc">Price · Low to High</SelectItem>
              <SelectItem value="price_desc">Price · High to Low</SelectItem>
              <SelectItem value="attendees_desc">Most popular</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">People & networking</h3>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-medium text-slate-700">Include community members</p>
            <p className="text-xs text-slate-500">Show people who match your keywords alongside events.</p>
          </div>
          <Switch id="include-users-filter" checked={includeUsers} onCheckedChange={toggleIncludeUsers} />
        </div>
      </section>

      {activeFilters.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Active filters</h3>
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((filter) => (
              <FilterChip key={filter.key} label={filter.label} onClear={filter.onClear} />
            ))}
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-3 text-xs text-slate-500">
              Clear all
            </Button>
          </div>
        </section>
      )}

      {withFooter && (
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <Button variant="outline" onClick={() => setFilterModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => setFilterModalOpen(false)}>
            Apply filters
          </Button>
        </div>
      )}
    </div>
  );


  return (
    <div
      className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[#f6f0e8] via-[#fef9f3] to-white"
      style={{ paddingBottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-120px] h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute right-[-80px] top-0 h-96 w-96 rounded-full bg-sky-200/30 blur-[140px]" />
        <div className="absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-white/80 via-white/60 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-24 pt-10 lg:px-8">
        <header className="relative overflow-hidden rounded-[36px] border border-white/60 bg-white/85 px-6 py-8 shadow-[0_45px_120px_-80px_rgba(15,23,42,0.6)] backdrop-blur">
          <div className="pointer-events-none absolute right-[-70px] top-[-100px] h-64 w-64 rounded-full bg-amber-100/70 blur-3xl" />
          <div className="pointer-events-none absolute left-[-70px] bottom-[-90px] h-56 w-56 rounded-full bg-slate-200/60 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="mt-1 h-11 w-11 rounded-full border border-transparent bg-white/80 text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-200 hover:shadow-md"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back</span>
              </Button>
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">Discover</p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  Explore events & experiences
                </h1>
                <p className="max-w-2xl text-sm text-slate-600">
                  Search by vibe, location, and date to find memorable things to do. YardPass surfaces trending picks and curated gems just for you.
                </p>
              </div>
            </div>
            <div className="grid gap-4 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm">
                <p className="font-semibold uppercase tracking-wide text-[11px] text-slate-500">Live results</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {displayedResults.length > 0 ? displayedResults.length : '—'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {lastUpdatedAt ? `Updated ${formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}` : 'Fresh events added hourly'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm">
                <p className="font-semibold uppercase tracking-wide text-[11px] text-slate-500">Personalized picks</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {recommendationsToRender.length > 0 ? recommendationsToRender.length : '—'}
                </p>
                <p className="text-[11px] text-slate-400">Hand-picked suggestions for you</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm">
                <p className="font-semibold uppercase tracking-wide text-[11px] text-slate-500">Filters active</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{filtersAppliedCount}</p>
                <p className="text-[11px] text-slate-400">Fine-tune to zero in on the right events</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8">
          <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/90 p-6 shadow-[0_40px_120px_-70px_rgba(15,23,42,0.5)] backdrop-blur">
            <div className="pointer-events-none absolute right-[-60px] top-[-60px] h-60 w-60 rounded-full bg-amber-100/70 blur-3xl" />
            <div className="pointer-events-none absolute left-[-50px] bottom-[-70px] h-56 w-56 rounded-full bg-slate-200/70 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="space-y-6">
                <div>
                  <label htmlFor="search-query-input" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Find events
                  </label>
                  <div className="relative mt-3">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="search-query-input"
                      value={q}
                      onChange={(e) => setParam('q', e.target.value)}
                      placeholder="Search events, organizers, or locations (press / to focus)"
                      className="h-12 rounded-2xl border-slate-200 bg-white/95 pl-11 text-base shadow-sm transition focus-visible:ring-2 focus-visible:ring-slate-900/20"
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  Try “live music”, “comedy night”, or “startup meetup”. We’ll keep your recent searches handy.
                </p>

                <div className="flex flex-wrap gap-2">
                  {quickSearchPresets.map((preset) => (
                    <Button
                      key={preset.value}
                      variant="secondary"
                      onClick={() => setParam('q', preset.value)}
                      className="rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-800 hover:shadow-md"
                    >
                      <Sparkles className="mr-2 h-3.5 w-3.5" />
                      {preset.label}
                    </Button>
                  ))}
                </div>

                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeFilters.map((filter) => (
                      <FilterChip key={`hero-${filter.key}`} label={filter.label} onClear={filter.onClear} />
                    ))}
                    <Button variant="link" size="sm" onClick={clearAll} className="text-xs text-slate-600">
                      Clear all
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/75 px-3 py-2 shadow-sm lg:hidden">
                  <Switch id="include-users-toggle" checked={includeUsers} onCheckedChange={toggleIncludeUsers} />
                  <Label htmlFor="include-users-toggle" className="text-xs font-medium text-slate-600">
                    Include people in results
                  </Label>
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:hidden">
                <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-sm">
                  <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Fine-tune results</p>
                        <p className="text-xs text-slate-500">
                          {filtersAppliedCount > 0 ? `${filtersAppliedCount} filters applied` : 'Use filters to personalize your feed'}
                        </p>
                      </div>
                      <DialogTrigger asChild>
                        <Button className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm transition hover:bg-white">
                          <SlidersHorizontal className="mr-2 h-4 w-4" />
                          Filters
                          {filtersAppliedCount > 0 && (
                            <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
                              {filtersAppliedCount}
                            </span>
                          )}
                        </Button>
                      </DialogTrigger>
                    </div>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Filter events</DialogTitle>
                      </DialogHeader>
                      <FilterForm withFooter />
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 text-xs text-slate-500 shadow-sm">
                  <p className="font-semibold text-slate-700">Pro tip</p>
                  <p className="mt-2">
                    Use “Tonight” or “This weekend” quick ranges to instantly refresh results without typing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {!q && recent.length > 0 && (
          <section className="mt-6">
            <div className="rounded-3xl border border-white/60 bg-white/85 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Recent searches</p>
                <Button variant="ghost" size="sm" onClick={clearRecent} className="h-7 px-3 text-xs text-slate-500">
                  Clear
                </Button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-10 space-y-6">
              <div className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-sm backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Filters</p>
                    <p className="text-xs text-slate-500">
                      {filtersAppliedCount > 0 ? `${filtersAppliedCount} filters active` : 'Refine your feed in real time'}
                    </p>
                  </div>
                  {filtersAppliedCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 px-3 text-xs text-slate-500">
                      Reset
                    </Button>
                  )}
                </div>
                <div className="mt-6 space-y-8">
                  <FilterForm />
                </div>
              </div>

              <div className="rounded-3xl border border-white/60 bg-white/80 p-6 text-sm text-slate-600 shadow-sm backdrop-blur">
                <div className="flex items-center gap-2 text-slate-700">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold">Search smarter</span>
                </div>
                <ul className="mt-3 space-y-2 text-xs text-slate-500">
                  <li>Combine categories with date ranges to uncover niche experiences.</li>
                  <li>Use the networking toggle to meet people going to similar events.</li>
                  <li>Save searches in your browser by bookmarking the results page.</li>
                </ul>
              </div>
            </div>
          </aside>

          <div className="space-y-10">
            {heroEvent && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {heroSubtitle && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{heroSubtitle}</p>
                    )}
                    <h2 className="mt-1 text-2xl font-semibold text-slate-900">Spotlight event</h2>
                  </div>
                  {displayedResults.length > 0 && (
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs text-slate-500 shadow-sm">
                      {displayedResults.length} {displayedResults.length === 1 ? 'match' : 'matches'}
                    </span>
                  )}
                </div>
                <EventCard
                  event={heroEvent}
                  onClick={handleHeroClick}
                  onTicket={heroTicketHandler}
                  className="border-none shadow-[0_40px_90px_-60px_rgba(15,23,42,0.55)]"
                />
              </section>
            )}

            {recommendationsToRender.length > 0 && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">{recommendationsLabel}</h2>
                  <span className="text-sm text-slate-500">Based on your activity</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {recommendationsToRender.map((rec, index) => (
                    <EventCard
                      key={rec.eventId || `rec-${index}`}
                      event={rec.event}
                      onClick={() => handleRecommendationClick(rec.eventId)}
                      onTicket={(eventId) => handleRecommendationTicketClick(eventId)}
                    />
                  ))}
                </div>
              </section>
            )}

            {includeUsers && (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold text-slate-900">People matching “{q || 'your search'}”</h2>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                    Beta
                  </Badge>
                </div>
                {userLoading ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <div key={idx} className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-12 w-12 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                        <Skeleton className="mt-4 h-9 w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : userResults.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {userResults.map((person) => (
                      <div
                        key={person.user_id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            {person.photo_url ? <AvatarImage src={person.photo_url} alt={person.display_name} /> : null}
                            <AvatarFallback>{person.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{person.display_name}</p>
                              {person.verification_status === 'verified' && (
                                <Badge variant="secondary" className="text-[10px] uppercase">
                                  Verified
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 capitalize">{person.role || 'attendee'}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                          {user?.id === person.user_id ? (
                            <span className="text-xs text-slate-400">This is you</span>
                          ) : (
                            <>
                              <FollowButton targetType="user" targetId={person.user_id} />
                              <MessageButton targetType="user" targetId={person.user_id} targetName={person.display_name} />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-500">
                    No people matched your search yet.
                  </div>
                )}
              </section>
            )}

            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {city.trim() ? `Events in ${city}` : 'All events'}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">Search results</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span>{resultsSummary}</span>
                  {isStale && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                      <span className="h-2 w-2 animate-ping rounded-full bg-amber-500" />
                      Updating…
                    </span>
                  )}
                  {lastUpdatedAt && !isStale && (
                    <span>Updated {formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}</span>
                  )}
                  {loading && !isInitialLoading && <span>Refreshing…</span>}
                </div>
              </div>

              {isInitialLoading ? (
                <SkeletonGrid />
              ) : displayedResults.length === 0 ? (
                <EmptyState onReset={clearAll} />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {visible.map((event, index) => (
                      <EventCard
                        key={event.item_id || event.id || `event-${index}`}
                        event={event}
                        onClick={() => handleResultClick(event)}
                        onTicket={(eventId) => handleResultTicketClick(event, eventId)}
                      />
                    ))}
                  </div>
                  {(visibleCount < displayedResults.length || hasMore) && (
                    <div ref={loaderRef} className="flex h-12 items-center justify-center text-sm text-slate-500">
                      {loading ? 'Loading more…' : hasMore ? 'Scroll to load more results' : 'You have reached the end'}
                    </div>
                  )}
                  {hasMore && !loading && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={loadMore}
                        className="mt-2 rounded-full border-slate-200 px-6 py-2 text-sm text-slate-700 hover:bg-white"
                      >
                        Load more results
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </section>
      </div>
    </div>
  )

}
