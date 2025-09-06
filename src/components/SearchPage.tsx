import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Search, Filter, MapPin, Calendar as CalendarIcon, Users, Star, X } from 'lucide-react';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SearchPageProps {
  onBack: () => void;
  onEventSelect: (event: any) => void;
}

const categories = [
  'All', 'Music', 'Food & Drink', 'Art & Culture', 'Sports & Fitness', 
  'Business & Professional', 'Community', 'Technology', 'Other'
];

// Mock search results
const mockSearchResults = [
  {
    id: '1',
    title: 'Summer Music Festival 2024',
    description: 'Three days of incredible music with top artists',
    organizer: 'LiveNation Events',
    organizerId: '101',
    category: 'Music',
    date: 'July 15-17, 2024',
    location: 'Central Park, NYC',
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080',
    ticketTiers: [
      { id: '1', name: 'General Admission', price: 89, badge: 'GA', available: 45, total: 1000 },
      { id: '2', name: 'VIP Experience', price: 199, badge: 'VIP', available: 12, total: 100 }
    ],
    attendeeCount: 1243,
    priceFrom: 89,
    rating: 4.8,
    likes: 892,
    shares: 156
  },
  {
    id: '2',
    title: 'Street Food Fiesta',
    description: 'Taste authentic flavors from around the world',
    organizer: 'Foodie Adventures',
    organizerId: '102',
    category: 'Food & Drink',
    date: 'August 8, 2024',
    location: 'Brooklyn Bridge Park',
    coverImage: 'https://images.unsplash.com/photo-1551883709-2516220df0bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080',
    ticketTiers: [
      { id: '3', name: 'Entry Pass', price: 25, badge: 'ENTRY', available: 234, total: 500 },
      { id: '4', name: 'Foodie Pass', price: 75, badge: 'FOODIE', available: 18, total: 50 }
    ],
    attendeeCount: 567,
    priceFrom: 25,
    rating: 4.6,
    likes: 445,
    shares: 89
  },
  {
    id: '3',
    title: 'Contemporary Art Showcase',
    description: 'Discover emerging artists and groundbreaking installations',
    organizer: 'Modern Gallery NYC',
    organizerId: '103',
    category: 'Art & Culture',
    date: 'September 2, 2024',
    location: 'SoHo Art District',
    coverImage: 'https://images.unsplash.com/photo-1713779490284-a81ff6a8ffae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnQlMjBnYWxsZXJ5JTIwZXhoaWJpdGlvbnxlbnwxfHx8fDE3NTY3NjI4ODd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    ticketTiers: [
      { id: '5', name: 'Standard', price: 35, badge: 'STD', available: 156, total: 200 },
      { id: '6', name: 'Premium', price: 85, badge: 'PREM', available: 23, total: 50 }
    ],
    attendeeCount: 298,
    priceFrom: 35,
    rating: 4.9,
    likes: 234,
    shares: 67
  }
];

export default function SearchPage({ onBack, onEventSelect }: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [results, setResults] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [locationFilter, setLocationFilter] = useState('');

  // Load real events from database
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const { data: eventsData, error } = await supabase
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
          .order('start_at', { ascending: true });

        if (error) {
          console.error('Error loading events for search:', error);
          setAllEvents(mockSearchResults);
          setResults(mockSearchResults);
        } else if (eventsData && eventsData.length > 0) {
          // Transform database events to match UI format
          const transformedEvents = eventsData.map(event => ({
            id: event.id,
            title: event.title,
            description: event.description || '',
            organizer: (event as any).user_profiles?.display_name || 'Organizer',
            organizerId: event.id,
            category: event.category || 'Other',
            date: new Date(event.start_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            }),
            location: event.city || event.venue || 'TBA',
            coverImage: event.cover_image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
            ticketTiers: [],
            attendeeCount: Math.floor(Math.random() * 1000) + 50,
            priceFrom: Math.floor(Math.random() * 100) + 25,
            rating: (Math.random() * 1 + 4).toFixed(1),
            likes: Math.floor(Math.random() * 500) + 10,
            shares: Math.floor(Math.random() * 100) + 5
          }));
          setAllEvents(transformedEvents);
          setResults(transformedEvents);
        } else {
          // No events found, use mock data
          setAllEvents(mockSearchResults);
          setResults(mockSearchResults);
        }
      } catch (error) {
        console.error('Error fetching events for search:', error);
        setAllEvents(mockSearchResults);
        setResults(mockSearchResults);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const applyFilters = () => {
    let filtered = allEvents;

    // Apply search query filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.organizer.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(event => event.category === selectedCategory);
    }

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.date);
        const isAfterFrom = !dateRange.from || eventDate >= dateRange.from;
        const isBeforeTo = !dateRange.to || eventDate <= dateRange.to;
        return isAfterFrom && isBeforeTo;
      });
    }

    // Apply location filter
    if (locationFilter.trim()) {
      filtered = filtered.filter(event =>
        event.location.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    setResults(filtered);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Trigger filter application when search changes
    setTimeout(applyFilters, 0);
  };

  const clearFilters = () => {
    setDateRange({});
    setLocationFilter('');
    setTimeout(applyFilters, 0);
  };

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    setTimeout(applyFilters, 0);
  };

  // Apply filters whenever dependencies change
  useEffect(() => {
    applyFilters();
  }, [selectedCategory, dateRange, locationFilter, allEvents]);

  if (loading) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <div className="flex items-center gap-4 p-4 border-b">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Search Events</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
              <Search className="text-white w-8 h-8" />
            </div>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1>Search Events</h1>
            <p className="text-sm text-muted-foreground">Discover amazing events near you</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search events, organizers, locations..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 pr-12"
          />
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2"
              >
                <Filter className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 bg-card border shadow-lg z-50" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Filters</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-xs"
                    >
                      Clear all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFilters(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Range</label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !dateRange.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {dateRange.from ? format(dateRange.from, "MMM dd") : "From"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !dateRange.to && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {dateRange.to ? format(dateRange.to, "MMM dd") : "To"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Location Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter city or location..."
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Active Filters Summary */}
                {(dateRange.from || dateRange.to || locationFilter) && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Active filters:</p>
                    <div className="flex flex-wrap gap-1">
                      {dateRange.from && (
                        <Badge variant="secondary" className="text-xs">
                          From: {format(dateRange.from, "MMM dd")}
                        </Badge>
                      )}
                      {dateRange.to && (
                        <Badge variant="secondary" className="text-xs">
                          To: {format(dateRange.to, "MMM dd")}
                        </Badge>
                      )}
                      {locationFilter && (
                        <Badge variant="secondary" className="text-xs">
                          Location: {locationFilter}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => handleCategoryFilter(category)}
              className="whitespace-nowrap"
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            {results.length} event{results.length !== 1 ? 's' : ''} found
            {searchQuery && ` for "${searchQuery}"`}
          </p>
        </div>

        <div className="space-y-4">
          {results.map((event) => (
            <Card 
              key={event.id} 
              className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onEventSelect) {
                  onEventSelect(event);
                }
              }}
            >
              <div className="flex" style={{ pointerEvents: 'none' }}>
                <ImageWithFallback
                  src={event.coverImage}
                  alt={event.title}
                  className="w-32 h-24 object-cover"
                  style={{ pointerEvents: 'none' }}
                />
                <div className="flex-1 p-4" style={{ pointerEvents: 'none' }}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium">{event.title}</h3>
                        <Badge variant="outline" className="text-xs" style={{ pointerEvents: 'none' }}>
                          {event.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{event.description}</p>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {event.date}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">From ${event.priceFrom}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {event.rating}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      {event.attendeeCount} attending
                    </div>
                    <span className="text-xs text-muted-foreground">by {event.organizer}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {results.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">No events found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}