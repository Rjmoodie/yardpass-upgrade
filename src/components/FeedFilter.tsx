import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Search, MapPin, Calendar, Check, Tag } from 'lucide-react';
import { EVENT_CATEGORIES } from '@/constants/categories';

interface FilterOptions {
  dates: string[];
  locations: string[];
  categories: string[];
  searchRadius: number;
}

interface FeedFilterProps {
  onFilterChange: (filters: FilterOptions) => void;
  isOpen: boolean;
  onToggle: () => void;
  value?: FilterOptions;
}

const cities = [
  { name: 'Near Me', icon: '📍' },
  { name: 'New York City', icon: '🗽' },
  { name: 'Miami', icon: '🏖️' },
  { name: 'Los Angeles', icon: '🌴' },
  { name: 'Washington DC', icon: '🏛️' },
  { name: 'Boston', icon: '⛵' },
  { name: 'Atlanta', icon: '🍑' },
];

const dateOptions = [
  'This Month',
  'This Weekend',
  'Tonight',
  'Halloween',
  'Next Week',
  'Next Month'
];

export function FeedFilter({ onFilterChange, isOpen, onToggle, value }: FeedFilterProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>(value?.dates?.length ? value.dates : ['This Month']);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(value?.locations?.length ? value.locations : ['Near Me']);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(value?.categories ?? []);
  const [searchRadius, setSearchRadius] = useState(value?.searchRadius ?? 25);

  const resetToValue = (next?: FilterOptions) => {
    const source = next ?? value;
    setSelectedDates(source?.dates?.length ? source.dates : ['This Month']);
    setSelectedLocations(source?.locations?.length ? source.locations : ['Near Me']);
    setSelectedCategories(source?.categories ?? []);
    setSearchRadius(source?.searchRadius ?? 25);
  };

  const externalFilterKey = useMemo(
    () =>
      JSON.stringify({
        dates: value?.dates ?? ['This Month'],
        locations: value?.locations ?? ['Near Me'],
        categories: value?.categories ?? [],
        searchRadius: value?.searchRadius ?? 25,
      }),
    [value?.dates, value?.locations, value?.categories, value?.searchRadius]
  );

  useEffect(() => {
    if (!isOpen) return;
    resetToValue(value);
  }, [isOpen, externalFilterKey]);

  const handleDateToggle = (date: string) => {
    setSelectedDates((prev) =>
      prev.includes(date)
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  const handleLocationToggle = (location: string) => {
    setSelectedLocations((prev) =>
      prev.includes(location)
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleApply = () => {
    const appliedFilters = {
      dates: selectedDates,
      locations: selectedLocations,
      categories: selectedCategories,
      searchRadius
    };
    
    console.log('🎯 [FeedFilter] Applying filters:', {
      dates: appliedFilters.dates,
      locations: appliedFilters.locations,
      categories: appliedFilters.categories,
      searchRadius: appliedFilters.searchRadius
    });
    
    onFilterChange(appliedFilters);
    onToggle();
  };

  const handleCancel = () => {
    resetToValue();
    onToggle();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md" onClick={onToggle}>
      <div 
        className="absolute inset-x-0 top-0 bottom-0 bg-card shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 flex-shrink-0">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCancel}
            className="text-foreground hover:text-foreground/80"
          >
            Cancel
          </Button>
          <h2 className="text-lg font-bold text-foreground">Filter Events</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleApply}
            className="text-primary font-bold hover:text-primary/80"
          >
            Apply
          </Button>
        </div>

        {/* Filter Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Dates Section */}
          <div className="p-5 border-b border-border bg-background">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-foreground" />
              <h3 className="text-base font-bold text-foreground">Dates</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {dateOptions.map((date) => (
                <button
                  key={date}
                  onClick={() => handleDateToggle(date)}
                  className={`px-4 py-2.5 rounded-xl border-2 transition-all font-medium ${
                    selectedDates.includes(date)
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : 'bg-muted/50 text-foreground border-border hover:border-primary/50 hover:bg-muted'
                  }`}
                >
                  {date}
                </button>
              ))}
            </div>
          </div>

          {/* Categories Section */}
          <div className="p-5 border-b border-border bg-background">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-5 h-5 text-foreground" />
              <h3 className="text-base font-bold text-foreground">Categories</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {EVENT_CATEGORIES.map((category) => (
                <button
                  key={category.value}
                  onClick={() => handleCategoryToggle(category.value)}
                  className={`px-4 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2 font-medium ${
                    selectedCategories.includes(category.value)
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : 'bg-muted/50 text-foreground border-border hover:border-primary/50 hover:bg-muted'
                  }`}
                >
                  <span className="text-base">{category.icon}</span>
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Location Section */}
          <div className="p-5 border-b border-border bg-background">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-foreground" />
              <h3 className="text-base font-bold text-foreground">Location</h3>
            </div>
            <div className="space-y-2">
              {cities.map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleLocationToggle(city.name)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
                    selectedLocations.includes(city.name)
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'bg-muted/30 border-border hover:border-primary/40 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{city.icon}</span>
                    <span className="text-foreground font-semibold">{city.name}</span>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedLocations.includes(city.name)
                      ? 'bg-primary border-primary'
                      : 'border-border'
                  }`}>
                    {selectedLocations.includes(city.name) && (
                      <Check className="w-4 h-4 text-primary-foreground" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Search Radius Section */}
          <div className="p-5 pb-nav bg-background">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-foreground" />
              <h3 className="text-base font-bold text-foreground">Search Radius</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-foreground/70 font-medium">Distance</span>
                <span className="text-primary font-bold text-lg">{searchRadius} miles</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
              />
              <div className="flex justify-between text-xs text-foreground/60 font-medium">
                <span>5 mi</span>
                <span>100 mi</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}