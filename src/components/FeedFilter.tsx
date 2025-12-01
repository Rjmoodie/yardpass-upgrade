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
  'Next Month',
];

export function FeedFilter({ onFilterChange, isOpen, onToggle, value }: FeedFilterProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>(
    value?.dates?.length ? value.dates : ['This Month']
  );
  const [selectedLocations, setSelectedLocations] = useState<string[]>(
    value?.locations?.length ? value.locations : ['Near Me']
  );
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
    setSelectedDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const handleLocationToggle = (location: string) => {
    setSelectedLocations(prev =>
      prev.includes(location) ? prev.filter(l => l !== location) : [...prev, location]
    );
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleApply = () => {
    const appliedFilters = {
      dates: selectedDates,
      locations: selectedLocations,
      categories: selectedCategories,
      searchRadius,
    };

    console.log('🎯 [FeedFilter] Applying filters:', {
      dates: appliedFilters.dates,
      locations: appliedFilters.locations,
      categories: appliedFilters.categories,
      searchRadius: appliedFilters.searchRadius,
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
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
      onClick={onToggle}
    >
      {/* Bottom sheet / centered card */}
      <div
        className="
          absolute inset-x-0 bottom-0
          max-h-[90dvh]
          rounded-t-3xl
          bg-card
          shadow-[0_-28px_80px_rgba(15,23,42,0.55)]
          border-t border-border/70
          flex flex-col
          md:inset-y-10 md:mx-auto md:max-w-xl md:rounded-3xl md:border
        "
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-border/80" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1 border-b border-border/70 bg-background/95">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Filters
            </span>
            <h2 className="text-xs font-medium tracking-tight text-foreground">
              Find events for you
            </h2>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleApply}
            className="px-2 text-xs font-semibold text-primary hover:text-primary/90"
          >
            Apply
          </Button>
        </div>

        {/* Filter Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-nav pt-4 space-y-4">
          {/* Dates */}
          <section className="rounded-2xl border border-border/70 bg-background/95 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <Calendar className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  When
                </p>
                <h3 className="text-xs font-medium text-foreground">Dates</h3>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {dateOptions.map(date => {
                const active = selectedDates.includes(date);
                return (
                  <button
                    key={date}
                    onClick={() => handleDateToggle(date)}
                    className={[
                      'px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-medium transition-all',
                      active
                        ? 'bg-primary/10 text-primary border-primary/50 shadow-sm'
                        : 'bg-muted/40 text-foreground border-border hover:border-primary/40 hover:bg-muted/70',
                    ].join(' ')}
                  >
                    {date}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Categories */}
          <section className="rounded-2xl border border-border/70 bg-background/95 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <Tag className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  What
                </p>
                <h3 className="text-xs font-medium text-foreground">Categories</h3>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {EVENT_CATEGORIES.map(category => {
                const active = selectedCategories.includes(category.value);
                return (
                  <button
                    key={category.value}
                    onClick={() => handleCategoryToggle(category.value)}
                    className={[
                      'px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-medium transition-all flex items-center gap-1.5',
                      active
                        ? 'bg-primary/10 text-primary border-primary/50 shadow-sm'
                        : 'bg-muted/40 text-foreground border-border hover:border-primary/40 hover:bg-muted/70',
                    ].join(' ')}
                  >
                    <span className="text-base">{category.icon}</span>
                    <span>{category.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Location */}
          <section className="rounded-2xl border border-border/70 bg-background/95 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <MapPin className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Where
                </p>
                <h3 className="text-xs font-medium text-foreground">Location</h3>
              </div>
            </div>

            <div className="space-y-1.5">
              {cities.map(city => {
                const active = selectedLocations.includes(city.name);
                return (
                  <button
                    key={city.name}
                    onClick={() => handleLocationToggle(city.name)}
                    className={[
                      'w-full flex items-center justify-between rounded-xl border px-3 py-2.5 text-xs transition-all',
                      active
                        ? 'bg-primary/8 border-primary/60 shadow-sm'
                        : 'bg-muted/30 border-border hover:border-primary/40 hover:bg-muted/60',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{city.icon}</span>
                      <span className="font-medium text-foreground">{city.name}</span>
                    </div>
                    <div
                      className={[
                        'flex h-5 w-5 items-center justify-center rounded-full border text-[11px] transition-all',
                        active
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border text-transparent',
                      ].join(' ')}
                    >
                      <Check className="h-3 w-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Radius */}
          <section className="rounded-2xl border border-border/70 bg-background/95 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <Search className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  How far
                </p>
                <h3 className="text-xs font-medium text-foreground">Search radius</h3>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Distance from location</span>
                <span className="text-xs font-semibold text-primary">
                  {searchRadius} miles
                </span>
              </div>

              <input
                type="range"
                min="5"
                max="100"
                value={searchRadius}
                onChange={e => setSearchRadius(parseInt(e.target.value))}
                className="
                  w-full h-2 rounded-full bg-muted
                  accent-primary
                  appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-primary
                  [&::-webkit-slider-thumb]:shadow-md
                "
              />

              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>5 mi</span>
                <span>100 mi</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
