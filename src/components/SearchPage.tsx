import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Filter, MapPin, Calendar, Users, Star } from 'lucide-react';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';

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
    category: 'Music',
    date: 'July 15-17, 2024',
    location: 'Central Park, NYC',
    coverImage: 'https://images.unsplash.com/photo-1681149341674-45fd772fd463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080',
    attendeeCount: 1243,
    priceFrom: 89,
    rating: 4.8
  },
  {
    id: '2',
    title: 'Street Food Fiesta',
    description: 'Taste authentic flavors from around the world',
    organizer: 'Foodie Adventures',
    category: 'Food & Drink',
    date: 'August 8, 2024',
    location: 'Brooklyn Bridge Park',
    coverImage: 'https://images.unsplash.com/photo-1551883709-2516220df0bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwZmVzdGl2YWwlMjBvdXRkb29yfGVufDF8fHx8MTc1Njc5OTY4OHww&ixlib=rb-4.1.0&q=80&w=1080',
    attendeeCount: 567,
    priceFrom: 25,
    rating: 4.6
  },
  {
    id: '3',
    title: 'Contemporary Art Showcase',
    description: 'Discover emerging artists and groundbreaking installations',
    organizer: 'Modern Gallery NYC',
    category: 'Art & Culture',
    date: 'September 2, 2024',
    location: 'SoHo Art District',
    coverImage: 'https://images.unsplash.com/photo-1713779490284-a81ff6a8ffae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnQlMjBnYWxsZXJ5JTIwZXhoaWJpdGlvbnxlbnwxfHx8fDE3NTY3NjI4ODd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    attendeeCount: 298,
    priceFrom: 35,
    rating: 4.9
  }
];

export default function SearchPage({ onBack, onEventSelect }: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [results, setResults] = useState(mockSearchResults);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Mock search logic
    if (query.trim()) {
      const filtered = mockSearchResults.filter(event =>
        event.title.toLowerCase().includes(query.toLowerCase()) ||
        event.description.toLowerCase().includes(query.toLowerCase()) ||
        event.organizer.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filtered);
    } else {
      setResults(mockSearchResults);
    }
  };

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    if (category === 'All') {
      setResults(mockSearchResults);
    } else {
      const filtered = mockSearchResults.filter(event => event.category === category);
      setResults(filtered);
    }
  };

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
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2"
          >
            <Filter className="w-4 h-4" />
          </Button>
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
              onClick={() => onEventSelect(event)}
            >
              <div className="flex">
                <ImageWithFallback
                  src={event.coverImage}
                  alt={event.title}
                  className="w-32 h-24 object-cover"
                />
                <div className="flex-1 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium">{event.title}</h3>
                        <Badge variant="outline" className="text-xs">
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