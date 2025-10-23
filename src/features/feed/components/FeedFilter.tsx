import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Search, MapPin, Calendar, Check } from 'lucide-react';

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
  const [searchRadius, setSearchRadius] = useState(value?.searchRadius ?? 25);

  const resetToValue = (next?: FilterOptions) => {
    const source = next ?? value;
    setSelectedDates(source?.dates?.length ? source.dates : ['This Month']);
    setSelectedLocations(source?.locations?.length ? source.locations : ['Near Me']);
    setSearchRadius(source?.searchRadius ?? 25);
  };

  const externalFilterKey = useMemo(
    () =>
      JSON.stringify({
        dates: value?.dates ?? ['This Month'],
        locations: value?.locations ?? ['Near Me'],
        searchRadius: value?.searchRadius ?? 25,
      }),
    [value?.dates, value?.locations, value?.searchRadius]
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

  const handleApply = () => {
    onFilterChange({
      dates: selectedDates,
      locations: selectedLocations,
      categories: [],
      searchRadius
    });
    onToggle();
  };

  const handleCancel = () => {
    resetToValue();
    onToggle();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-x-0 top-0 bg-surface-1 border-b border-border rounded-b-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCancel}
            className="text-text-2"
          >
            Cancel
          </Button>
          <h2 className="text-lg font-semibold text-text">Filter Events</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleApply}
            className="text-accent font-semibold"
          >
            Apply
          </Button>
        </div>

        {/* Filter Content */}
        <div className="max-h-[70vh] overflow-y-auto">
          {/* Dates Section */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-text" />
              <h3 className="text-base font-semibold text-text">Dates</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {dateOptions.map((date) => (
                <button
                  key={date}
                  onClick={() => handleDateToggle(date)}
                  className={`px-4 py-2 rounded-xl border transition-all ${
                    selectedDates.includes(date)
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface-2 text-text-2 border-border hover:border-accent/50'
                  }`}
                >
                  {date}
                </button>
              ))}
            </div>
          </div>

          {/* Location Section */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-text" />
              <h3 className="text-base font-semibold text-text">Location</h3>
            </div>
            <div className="space-y-3">
              {cities.map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleLocationToggle(city.name)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-border hover:border-accent/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{city.icon}</span>
                    <span className="text-text font-medium">{city.name}</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedLocations.includes(city.name)
                      ? 'bg-accent border-accent'
                      : 'border-border'
                  }`}>
                    {selectedLocations.includes(city.name) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                </button>
              ))}
              
              {/* Custom Location Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter a city..."
                  className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-border text-black placeholder:text-gray-500 focus:outline-none focus:border-accent"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 rounded-full border-2 border-border"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Search Radius Section */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-text" />
              <h3 className="text-base font-semibold text-text">Search Radius</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text-2">Distance</span>
                <span className="text-accent font-semibold">{searchRadius} miles</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                value={searchRadius}
                onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accent"
              />
              <div className="flex justify-between text-xs text-text-3">
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