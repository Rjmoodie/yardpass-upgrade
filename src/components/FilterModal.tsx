import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Calendar, DollarSign, Users, Clock, Star, Filter } from 'lucide-react';

export type LocationFilterOption = 'near-me' | 'city' | 'state' | 'country' | 'custom';
export type TimeFilterOption = 'anytime' | 'today' | 'tomorrow' | 'this-week' | 'this-weekend' | 'this-month' | 'next-month' | 'custom';
export type SortOption = 'relevance' | 'date' | 'distance' | 'popularity' | 'price-low' | 'price-high' | 'newest';
export type PriceRange = 'free' | 'under-25' | '25-50' | '50-100' | '100-200' | '200-plus' | 'any';
export type EventType = 'all' | 'music' | 'sports' | 'food' | 'art' | 'tech' | 'networking' | 'fitness' | 'comedy' | 'education';

export interface FilterSelections {
  location: LocationFilterOption;
  time: TimeFilterOption;
  sort: SortOption;
  priceRange: PriceRange;
  eventTypes: EventType[];
  maxDistance: number;
  customLocation?: string;
  customDateFrom?: string;
  customDateTo?: string;
  includeOnline: boolean;
  includeSoldOut: boolean;
  minRating: number;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterSelections) => void;
  currentFilters: FilterSelections;
}

export function FilterModal({ isOpen, onClose, onApply, currentFilters }: FilterModalProps) {
  const [filters, setFilters] = useState<FilterSelections>({
    location: 'near-me',
    time: 'anytime',
    sort: 'relevance',
    priceRange: 'any',
    eventTypes: ['all'],
    maxDistance: 25,
    includeOnline: true,
    includeSoldOut: false,
    minRating: 0,
    ...currentFilters
  });

  useEffect(() => {
    console.log('FilterModal: isOpen changed to:', isOpen);
    console.log('FilterModal: currentFilters:', currentFilters);
    setFilters(prev => ({ ...prev, ...currentFilters }));
  }, [currentFilters, isOpen]);

  // Debug filter changes
  useEffect(() => {
    console.log('FilterModal: Current filter state:', filters);
  }, [filters]);

  const handleApply = () => {
    console.log('FilterModal: Applying filters:', filters);
    onApply(filters);
  };

  const handleEventTypeToggle = (eventType: EventType) => {
    console.log('FilterModal: Toggling event type:', eventType);
    setFilters(prev => {
      const newEventTypes = prev.eventTypes.includes(eventType)
        ? prev.eventTypes.filter(t => t !== eventType)
        : [...prev.eventTypes, eventType];
      console.log('FilterModal: New event types:', newEventTypes);
      return {
        ...prev,
        eventTypes: newEventTypes
      };
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.location !== 'near-me') count++;
    if (filters.time !== 'anytime') count++;
    if (filters.priceRange !== 'any') count++;
    if (filters.eventTypes.length > 0 && !filters.eventTypes.includes('all')) count++;
    if (filters.maxDistance !== 25) count++;
    if (filters.customLocation) count++;
    if (filters.customDateFrom || filters.customDateTo) count++;
    if (!filters.includeOnline) count++;
    if (filters.includeSoldOut) count++;
    if (filters.minRating > 0) count++;
    if (filters.sort !== 'relevance') count++;
    return count;
  };

  const clearAllFilters = () => {
    console.log('FilterModal: Clearing all filters');
    setFilters({
      location: 'near-me',
      time: 'anytime',
      sort: 'relevance',
      priceRange: 'any',
      eventTypes: ['all'],
      maxDistance: 25,
      includeOnline: true,
      includeSoldOut: false,
      minRating: 0
    });
  };

  const eventTypeOptions = [
    { value: 'music', label: 'Concerts & Live Music', icon: '🎵', description: 'Bands, DJs, acoustic shows' },
    { value: 'sports', label: 'Sports & Fitness', icon: '⚽', description: 'Games, tournaments, workouts' },
    { value: 'food', label: 'Food & Drink Events', icon: '🍕', description: 'Tastings, cooking classes, wine' },
    { value: 'art', label: 'Art & Culture', icon: '🎨', description: 'Galleries, museums, exhibitions' },
    { value: 'tech', label: 'Tech & Innovation', icon: '💻', description: 'Conferences, workshops, demos' },
    { value: 'networking', label: 'Professional Networking', icon: '🤝', description: 'Meetups, conferences, mixers' },
    { value: 'fitness', label: 'Fitness & Wellness', icon: '💪', description: 'Yoga, running, health events' },
    { value: 'comedy', label: 'Comedy & Entertainment', icon: '😂', description: 'Stand-up, improv, shows' },
    { value: 'education', label: 'Learning & Workshops', icon: '📚', description: 'Classes, seminars, training' }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Advanced Filters
            </div>
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="bg-brand-100 text-brand-800">
                {getActiveFilterCount()} active
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Location Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-600" />
              <Label className="text-sm font-semibold">Location</Label>
            </div>
            <div className="grid gap-3">
              <Select
                value={filters.location}
                onValueChange={(value: LocationFilterOption) => setFilters(prev => ({ ...prev, location: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose location preference" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="near-me">📍 Within 5 miles of me</SelectItem>
                  <SelectItem value="city">🏙️ Within my city limits</SelectItem>
                  <SelectItem value="state">🗺️ Within my state/province</SelectItem>
                  <SelectItem value="country">🌍 Within my country</SelectItem>
                  <SelectItem value="custom">✏️ Specific address or venue</SelectItem>
                </SelectContent>
              </Select>
              
              {filters.location === 'custom' && (
                <Input
                  placeholder="Enter city, address, or venue..."
                  value={filters.customLocation || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, customLocation: e.target.value }))}
                />
              )}
              
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Maximum distance: {filters.maxDistance} miles</Label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={filters.maxDistance}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxDistance: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Time Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-600" />
              <Label className="text-sm font-semibold">When</Label>
            </div>
            <Select
              value={filters.time}
              onValueChange={(value: TimeFilterOption) => setFilters(prev => ({ ...prev, time: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anytime">🕐 All upcoming events</SelectItem>
                <SelectItem value="today">📅 Today only</SelectItem>
                <SelectItem value="tomorrow">📅 Tomorrow only</SelectItem>
                <SelectItem value="this-week">📅 Next 7 days</SelectItem>
                <SelectItem value="this-weekend">🎉 This Saturday & Sunday</SelectItem>
                <SelectItem value="this-month">📅 Next 30 days</SelectItem>
                <SelectItem value="next-month">📅 Next 30-60 days</SelectItem>
                <SelectItem value="custom">✏️ Pick specific dates</SelectItem>
              </SelectContent>
            </Select>
            
            {filters.time === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-600">From</Label>
                  <Input
                    type="date"
                    value={filters.customDateFrom || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, customDateFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">To</Label>
                  <Input
                    type="date"
                    value={filters.customDateTo || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, customDateTo: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Price Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-slate-600" />
              <Label className="text-sm font-semibold">Price Range</Label>
            </div>
            <Select
              value={filters.priceRange}
              onValueChange={(value: PriceRange) => setFilters(prev => ({ ...prev, priceRange: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose price range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">💰 Show all prices</SelectItem>
                <SelectItem value="free">🆓 Free events only</SelectItem>
                <SelectItem value="under-25">💵 Budget-friendly ($0-$25)</SelectItem>
                <SelectItem value="25-50">💵 Affordable ($25-$50)</SelectItem>
                <SelectItem value="50-100">💵 Mid-range ($50-$100)</SelectItem>
                <SelectItem value="100-200">💵 Premium ($100-$200)</SelectItem>
                <SelectItem value="200-plus">💵 High-end ($200+)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Event Types Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-600" />
              <Label className="text-sm font-semibold">Event Types</Label>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {eventTypeOptions.map((option) => (
                <div key={option.value} className="flex items-start space-x-3 p-2 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <Checkbox
                    id={option.value}
                    checked={filters.eventTypes.includes(option.value as EventType)}
                    onCheckedChange={() => handleEventTypeToggle(option.value as EventType)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label htmlFor={option.value} className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <span>{option.icon}</span>
                      {option.label}
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Additional Options */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-600" />
              <Label className="text-sm font-semibold">Additional Options</Label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-online"
                  checked={filters.includeOnline}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, includeOnline: !!checked }))}
                />
                <Label htmlFor="include-online" className="text-sm">Include online events</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-sold-out"
                  checked={filters.includeSoldOut}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, includeSoldOut: !!checked }))}
                />
                <Label htmlFor="include-sold-out" className="text-sm">Include sold out events</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Sort Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-slate-600" />
              <Label className="text-sm font-semibold">Sort by</Label>
            </div>
            <Select
              value={filters.sort}
              onValueChange={(value: SortOption) => setFilters(prev => ({ ...prev, sort: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose sorting" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">🎯 Best matches for me</SelectItem>
                <SelectItem value="date">📅 Soonest events first</SelectItem>
                <SelectItem value="distance">📍 Closest to me</SelectItem>
                <SelectItem value="popularity">🔥 Most attended</SelectItem>
                <SelectItem value="price-low">💰 Cheapest first</SelectItem>
                <SelectItem value="price-high">💰 Most expensive first</SelectItem>
                <SelectItem value="newest">🆕 Just added</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={clearAllFilters} className="w-full sm:w-auto">
            Clear all
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Apply filters
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FilterModal;
