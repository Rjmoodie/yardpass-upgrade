import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Calendar, DollarSign, Filter, X } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { supabase } from "@/integrations/supabase/client";
import { transformEvents } from "@/lib/dataTransformers";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchResult {
  id: string;
  type: 'event' | 'organizer';
  title: string;
  subtitle: string;
  image: string;
  date?: string;
  location?: string;
  price?: string;
  category?: string;
}

const categories = ["All", "Music", "Sports", "Comedy", "Food", "Conference", "Art", "Nightlife"];

export function SearchPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Search function
  const performSearch = useCallback(async () => {
    setLoading(true);

    try {
      let query = supabase
        .from('events')
        .select(`
          id,
          title,
          description,
          start_at,
          venue,
          address,
          cover_image_url,
          category,
          ticket_tiers!fk_ticket_tiers_event_id (
            price_cents
          ),
          user_profiles!events_created_by_fkey (
            display_name
          )
        `)
        .eq('visibility', 'public');

      // Text search
      if (debouncedSearch) {
        query = query.or(`title.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      }

      // Category filter
      if (selectedCategory && selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }

      // Date filter
      const now = new Date();
      if (dateFilter === 'today') {
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59);
        query = query.gte('start_at', now.toISOString()).lte('start_at', endOfDay.toISOString());
      } else if (dateFilter === 'week') {
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + 7);
        query = query.gte('start_at', now.toISOString()).lte('start_at', endOfWeek.toISOString());
      } else if (dateFilter === 'month') {
        const endOfMonth = new Date(now);
        endOfMonth.setMonth(now.getMonth() + 1);
        query = query.gte('start_at', now.toISOString()).lte('start_at', endOfMonth.toISOString());
      } else {
        // Show only future events by default
        query = query.gte('start_at', now.toISOString());
      }

      query = query.order('start_at', { ascending: true }).limit(50);

      const { data, error } = await query;

      if (error) throw error;

      // Transform to SearchResult format
      const transformedResults: SearchResult[] = (data || []).map((event: any) => {
        const minPrice = event.ticket_tiers?.reduce((min: number, tier: any) => 
          Math.min(min, tier.price_cents || Infinity), Infinity);
        
        const price = minPrice && minPrice !== Infinity 
          ? `From $${(minPrice / 100).toFixed(0)}`
          : 'Free';

        // Apply price filter
        if (priceRange === 'free' && minPrice > 0) return null;
        if (priceRange === 'under-50' && minPrice >= 5000) return null;
        if (priceRange === 'over-50' && minPrice < 5000) return null;

        return {
          id: event.id,
          type: 'event' as const,
          title: event.title,
          subtitle: event.user_profiles?.display_name || 'Organizer',
          image: event.cover_image_url || '',
          date: new Date(event.start_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          location: `${event.venue || 'Venue TBA'}${event.address ? ', ' + event.address : ''}`,
          price,
          category: event.category || undefined
        };
      }).filter(Boolean) as SearchResult[];

      setResults(transformedResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedCategory, dateFilter, priceRange]);

  // Trigger search on filter changes
  useEffect(() => {
    performSearch();
  }, [performSearch]);

  return (
    <div className="min-h-screen bg-black pb-20 pt-4 sm:pt-6">
      {/* Search Header */}
      <div className="sticky top-0 z-40 bg-black/80 px-3 pb-4 backdrop-blur-xl sm:px-4 md:px-6">
        {/* Search Bar */}
        <div className="mb-4 flex gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50 sm:h-5 sm:w-5 sm:left-4" />
            <input
              type="text"
              placeholder="Search events, organizers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-white/50 focus:border-[#FF8C00] focus:bg-white/10 focus:outline-none sm:h-12 sm:pl-12 sm:text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white sm:right-4"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all sm:h-12 sm:w-12 ${
              showFilters
                ? 'border-[#FF8C00] bg-[#FF8C00]/20'
                : 'border-white/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <Filter className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Category Pills */}
        <div className="hide-scrollbar flex gap-2 overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-all sm:px-5 sm:py-2 sm:text-sm ${
                selectedCategory === category
                  ? 'bg-[#FF8C00] text-white shadow-lg'
                  : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl sm:p-5">
            {/* Price Range */}
            <div>
              <label className="mb-2 block text-xs font-medium text-white/70 sm:text-sm">Price Range</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {['all', 'free', 'under-50', 'over-50'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setPriceRange(range)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-all sm:text-sm ${
                      priceRange === range
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {range === 'all' && 'All Prices'}
                    {range === 'free' && 'Free'}
                    {range === 'under-50' && 'Under $50'}
                    {range === 'over-50' && '$50+'}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Filter */}
            <div>
              <label className="mb-2 block text-xs font-medium text-white/70 sm:text-sm">Date</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {['all', 'today', 'week', 'month'].map((date) => (
                  <button
                    key={date}
                    onClick={() => setDateFilter(date)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-all sm:text-sm ${
                      dateFilter === date
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {date === 'all' && 'Anytime'}
                    {date === 'today' && 'Today'}
                    {date === 'week' && 'This Week'}
                    {date === 'month' && 'This Month'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="px-3 pt-2 sm:px-4 md:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-[#FF8C00]" />
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-white/60 sm:text-base">
              {results.length} event{results.length !== 1 ? 's' : ''} found
            </p>

            {/* Results Grid */}
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => navigate(`/e/${result.id}`)}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl transition-all hover:scale-[1.02] hover:border-white/20 hover:shadow-xl sm:rounded-3xl text-left"
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <ImageWithFallback
                      src={result.image}
                      alt={result.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                    
                    {/* Category Badge */}
                    {result.category && (
                      <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md sm:px-3 sm:text-xs">
                        {result.category}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3 sm:p-4">
                    <h3 className="mb-1 text-base font-bold text-white line-clamp-2 sm:text-lg">{result.title}</h3>
                    <p className="mb-3 text-xs text-white/60 sm:text-sm">{result.subtitle}</p>

                    {/* Details */}
                    <div className="space-y-1.5">
                      {result.date && (
                        <div className="flex items-center gap-2 text-xs text-white/70 sm:text-sm">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>{result.date}</span>
                        </div>
                      )}
                      {result.location && (
                        <div className="flex items-center gap-2 text-xs text-white/70 sm:text-sm">
                          <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="line-clamp-1">{result.location}</span>
                        </div>
                      )}
                      {result.price && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-white/70 sm:text-sm">
                          <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>{result.price}</span>
                        </div>
                      )}
                    </div>

                    {/* CTA Button */}
                    <div className="mt-3 w-full rounded-full bg-[#FF8C00] py-2 text-center text-xs font-semibold text-white transition-all group-hover:bg-[#FF9D1A] sm:py-2.5 sm:text-sm">
                      View Details
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Empty State */}
            {!loading && results.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-xl sm:rounded-3xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                  <Search className="h-8 w-8 text-white/30" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-white">No events found</h3>
                <p className="text-sm text-white/60">
                  Try adjusting your search or filters
                </p>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setPriceRange('all');
                    setDateFilter('all');
                  }}
                  className="mt-6 rounded-full bg-[#FF8C00] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#FF9D1A] active:scale-95"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
