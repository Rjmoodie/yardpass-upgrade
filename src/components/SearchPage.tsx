import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ArrowLeft, Search, X, SlidersHorizontal, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { FilterChip } from './search/FilterChip';
import { EventCard } from './search/EventCard';
import { SkeletonGrid, EmptyState } from './search/SearchPageComponents';

interface SearchPageProps {
  onBack: () => void;
  onEventSelect: (event: any) => void;
}

const categories = [
  'All', 'Music', 'Food & Drink', 'Art & Culture', 'Sports & Fitness', 
  'Business & Professional', 'Community', 'Technology', 'Other'
];

// ————————————————————————————————————————
// Mock fallback
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

export default function SearchPage({ onBack, onEventSelect }: SearchPageProps) {
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

  // data state
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // fetch
  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
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
            )
          `)
          .eq('visibility', 'public')
          .order('start_at', { ascending: true })
          .limit(50);
        if (error) throw error;
        const transformed = (data || []).map((e: any) => ({
          id: e.id,
          title: e.title,
          description: e.description || '',
          organizer: e.user_profiles?.display_name || 'Organizer',
          organizerId: e.id,
          category: e.category || 'Other',
          date: new Date(e.start_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          location: e.city || e.venue || 'TBA',
          coverImage: e.cover_image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=60',
          attendeeCount: Math.floor(Math.random()*900)+50,
          priceFrom: Math.floor(Math.random()*100)+15,
          rating: 4 + Math.random(),
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
  }, []);

  // apply filters + debounce on url param change
  useEffect(() => {
    const t = setTimeout(() => {
      let filtered = [...allEvents];

      if (q) {
        const s = q.toLowerCase();
        filtered = filtered.filter(e =>
          e.title.toLowerCase().includes(s) ||
          e.description.toLowerCase().includes(s) ||
          e.organizer.toLowerCase().includes(s) ||
          e.location.toLowerCase().includes(s)
        );
      }

      if (cat !== 'All') filtered = filtered.filter(e => e.category === cat);
      if (city) filtered = filtered.filter(e => e.location.toLowerCase().includes(city.toLowerCase()));
      if (min) filtered = filtered.filter(e => (e.priceFrom ?? 0) >= Number(min));
      if (max) filtered = filtered.filter(e => (e.priceFrom ?? 0) <= Number(max));

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
        // date_asc default — assume incoming already ordered
        return 0;
      });

      setResults(filtered);
    }, 200);
    return () => clearTimeout(t);
  }, [allEvents, q, cat, city, sort, min, max, from, to]);

  // helpers to update url params succinctly
  const setParam = (k: string, v?: string) => {
    const next = new URLSearchParams(params);
    if (v && v.length) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const clearAll = () => {
    setParams(new URLSearchParams(), { replace: true });
  };

  // ————————————————————————————————————————
  // Render
  // ————————————————————————————————————————
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold truncate">Search Events</h1>
              <p className="text-sm text-muted-foreground">Discover amazing events near you</p>
            </div>
          </div>

          {/* Search / controls */}
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setParam('q', e.target.value)}
                placeholder="Search events, organizers, locations…"
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

                  {/* Date range (two pickers for clarity on mobile) */}
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
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {loading ? (
            <SkeletonGrid />
          ) : results.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {results.map((e) => (
                <EventCard key={e.id} event={e} onClick={() => onEventSelect?.(e.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
