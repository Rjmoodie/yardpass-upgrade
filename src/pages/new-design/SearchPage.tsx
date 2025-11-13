import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Calendar, DollarSign, Filter, X, Building2 } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { EVENT_CATEGORIES } from "@/constants/categories";
import { SponsorBadges } from "@/components/sponsorship/SponsorBadges";

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

const categories = ["All", ...EVENT_CATEGORIES.map(c => c.label)];

export default function SearchPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Search function using full-text search with intelligent ranking
  const performSearch = useCallback(async () => {
    setLoading(true);

    try {
      // Build filters object
      const filters: {
        categories?: string[];
        dateFilters?: string[];
        priceRange?: string;
        searchRadius?: number;
      } = {};

      if (selectedCategory && selectedCategory !== 'All') {
        filters.categories = [selectedCategory];
      }

      if (dateFilter && dateFilter !== 'all') {
        filters.dateFilters = [dateFilter];
      }

      if (priceRange && priceRange !== 'all') {
        filters.priceRange = priceRange;
      }

      // Prepare request body
      const requestBody: any = {
        searchText: debouncedSearch || '',
        filters,
        limit: 50,
      };

      // ✅ Reduced logging (only if verbose mode enabled)
      if (import.meta.env.DEV && localStorage.getItem('verbose_search') === 'true') {
        console.log('[SearchPage] Calling search-events with:', requestBody);
      }

      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession();

      // Call the search edge function
      const { data, error } = await supabase.functions.invoke('search-events', {
        body: requestBody,
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });

      if (error) {
        console.error('[SearchPage] Search function error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Search failed');
      }

      // ✅ Single clean log
      if (import.meta.env.DEV) {
        console.log(`🔍 Found ${data.results?.length || 0} events`);
      }

      // Transform event results
      const eventResults: SearchResult[] = (data.results || []).map((event: any) => {
        const price = event.min_price_cents 
          ? `From $${(event.min_price_cents / 100).toFixed(0)}`
          : 'Free';

        return {
          id: event.event_id,
          type: 'event' as const,
          title: event.title,
          subtitle: event.organizer_name || 'Organizer',
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
      });

      // Also search for organizers if there's a query
      let organizerResults: SearchResult[] = [];
      if (debouncedSearch.trim()) {
        try {
          const { data: orgs, error: orgError } = await supabase
            .from('organizations')
            .select('id, name, description, logo_url, location, verification_status')
            .or(`name.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`)
            .limit(10);

          if (!orgError && orgs) {
            organizerResults = orgs.map((org: any) => ({
              id: org.id,
              type: 'organizer' as const,
              title: org.name,
              subtitle: org.description || 'Event Organizer',
              image: org.logo_url || '',
              location: org.location || undefined,
              category: org.verification_status === 'verified' ? 'Verified' : undefined
            }));
          }
        } catch (err) {
          console.error('[SearchPage] Error searching organizers:', err);
        }
      }

      // Combine results (organizers first, then events)
      const combinedResults = [...organizerResults, ...eventResults];
      setResults(combinedResults);
    } catch (error) {
      console.error('[SearchPage] Search error:', error);
      setResults([]);
      toast({
        title: "Search Error",
        description: "Failed to load events. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedCategory, dateFilter, priceRange, toast]);

  // Trigger search on filter changes
  useEffect(() => {
    let cancelled = false;
    
    performSearch().then(() => {
      if (cancelled) {
        console.debug('[SearchPage] Search cancelled (unmounted)');
      }
    });
    
    return () => {
      cancelled = true;
    };
  }, [performSearch]); // ✅ With cancellation token

  return (
    <div className="min-h-screen bg-background pb-nav pt-4 sm:pt-6">
      {/* Search Header */}
      <div className="sticky top-0 z-40 bg-background/80 px-3 pb-4 backdrop-blur-xl sm:px-4 md:px-6">
        {/* Search Bar */}
        <div className="mb-4 flex gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50 sm:h-5 sm:w-5 sm:left-4" />
            <input
              type="text"
              placeholder="Search events, organizers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-full border border-border/30 bg-muted/20 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-muted/30 focus:outline-none sm:h-12 sm:pl-12 sm:text-base"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground sm:right-4"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all sm:h-12 sm:w-12 ${
              showFilters
                ? 'border-primary bg-primary/20'
                : 'border-border/10 bg-white/5 hover:bg-white/10'
            }`}
          >
            <Filter className="h-4 w-4 text-foreground sm:h-5 sm:w-5" />
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
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'border border-border/10 bg-white/5 text-foreground/70 hover:bg-white/10'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 space-y-3 rounded-2xl border border-border/10 bg-background/60 p-4 backdrop-blur-xl sm:p-5">
            {/* Price Range */}
            <div>
              <label className="mb-2 block text-xs font-medium text-foreground/70 sm:text-sm">Price Range</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {['all', 'free', 'under-50', 'over-50'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setPriceRange(range)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-all sm:text-sm ${
                      priceRange === range
                        ? 'bg-white/20 text-foreground'
                        : 'bg-white/5 text-foreground/60 hover:bg-white/10'
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
              <label className="mb-2 block text-xs font-medium text-foreground/70 sm:text-sm">Date</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {['all', 'today', 'week', 'month'].map((date) => (
                  <button
                    key={date}
                    onClick={() => setDateFilter(date)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-all sm:text-sm ${
                      dateFilter === date
                        ? 'bg-white/20 text-foreground'
                        : 'bg-white/5 text-foreground/60 hover:bg-white/10'
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
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-border/20 border-t-primary" />
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-foreground/60 sm:text-base">
              {results.length} result{results.length !== 1 ? 's' : ''} found
              {results.filter(r => r.type === 'organizer').length > 0 && (
                <span className="ml-2 text-xs text-foreground/50">
                  ({results.filter(r => r.type === 'organizer').length} organizer{results.filter(r => r.type === 'organizer').length !== 1 ? 's' : ''}, {results.filter(r => r.type === 'event').length} event{results.filter(r => r.type === 'event').length !== 1 ? 's' : ''})
                </span>
              )}
            </p>

            {/* Results Grid */}
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    if (result.type === 'organizer') {
                      console.log('[SearchPage] Navigating to organizer:', result.id);
                      navigate(`/org/${result.id}`);
                    } else {
                      console.log('[SearchPage] Navigating to event:', result.id);
                      navigate(`/e/${result.id}`);
                    }
                  }}
                  className="group overflow-hidden rounded-2xl border border-border/10 bg-white/5 backdrop-blur-xl transition-all hover:scale-[1.02] hover:border-border/20 hover:shadow-xl sm:rounded-3xl text-left"
                >
                  {/* Image */}
                  <div className="relative aspect-[21/9] overflow-hidden">
                    <ImageWithFallback
                      src={result.image}
                      alt={result.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
                    
                    {/* Category Badge */}
                    {result.category && (
                      <div className="absolute right-2 top-2 rounded-full bg-background/60 px-2 py-1 text-[10px] font-semibold text-foreground backdrop-blur-md sm:px-3 sm:text-xs">
                        {result.category}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-2.5 sm:p-3">
                    <h3 className="mb-0.5 text-sm font-bold text-foreground line-clamp-1 sm:text-base">{result.title}</h3>
                    <p className="mb-2 text-[11px] text-foreground/60 line-clamp-1 sm:text-xs">{result.subtitle}</p>

                    {/* Details */}
                    <div className="space-y-1.5">
                      {result.type === 'event' ? (
                        <>
                          {result.date && (
                            <div className="flex items-center gap-1.5 text-[11px] text-foreground/70 sm:text-xs">
                              <Calendar className="h-3 w-3" />
                              <span>{result.date}</span>
                            </div>
                          )}
                          {result.location && (
                            <div className="flex items-center gap-1.5 text-[11px] text-foreground/70 sm:text-xs">
                              <MapPin className="h-3 w-3" />
                              <span className="line-clamp-1">{result.location}</span>
                            </div>
                          )}
                          {result.price && (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/70 sm:text-xs">
                              <DollarSign className="h-3 w-3" />
                              <span>{result.price}</span>
                            </div>
                          )}
                          {/* Sponsor Badge */}
                          <div className="pt-1">
                            <SponsorBadges eventId={result.id} variant="compact" />
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Organizer-specific info */}
                          {result.location && (
                            <div className="flex items-center gap-1.5 text-[11px] text-foreground/70 sm:text-xs">
                              <MapPin className="h-3 w-3" />
                              <span className="line-clamp-1">{result.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-[11px] text-primary/80 font-medium sm:text-xs">
                            <Building2 className="h-3 w-3" />
                            <span>Event Organizer</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* CTA Button */}
                    <div className="mt-2 w-full rounded-full bg-primary py-1.5 text-center text-xs font-semibold text-primary-foreground transition-all group-hover:bg-primary/90 sm:py-2 sm:text-sm">
                      {result.type === 'organizer' ? 'View Profile' : 'View Details'}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Empty State */}
            {!loading && results.length === 0 && (
              <div className="rounded-2xl border border-border/10 bg-white/5 p-12 text-center backdrop-blur-xl sm:rounded-3xl">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                  <Search className="h-8 w-8 text-foreground/30" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">No events found</h3>
                <p className="text-sm text-foreground/60">
                  Try adjusting your search or filters
                </p>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setPriceRange('all');
                    setDateFilter('all');
                  }}
                  className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
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
