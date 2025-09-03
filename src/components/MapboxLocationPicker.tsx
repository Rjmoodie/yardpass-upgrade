import React, { useEffect, useRef, useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { MapPin, Search } from 'lucide-react';

interface Location {
  address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

interface MapboxLocationPickerProps {
  value?: Location;
  onChange: (location: Location) => void;
  className?: string;
}

export function MapboxLocationPicker({ value, onChange, className }: MapboxLocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState(value?.address || '');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimeout = useRef<NodeJS.Timeout>();

  // For now, we'll use a simple geocoding approach
  // In a production app, you'd integrate with Mapbox Geocoding API
  const mockGeocoding = async (query: string) => {
    // Mock data for demonstration
    const mockResults = [
      {
        place_name: `${query}, New York, NY, USA`,
        center: [-74.006, 40.7128],
        context: [
          { id: 'place', text: 'New York' },
          { id: 'region', text: 'New York' },
          { id: 'country', text: 'United States' }
        ]
      },
      {
        place_name: `${query}, Los Angeles, CA, USA`,
        center: [-118.2437, 34.0522],
        context: [
          { id: 'place', text: 'Los Angeles' },
          { id: 'region', text: 'California' },
          { id: 'country', text: 'United States' }
        ]
      }
    ];
    
    return mockResults.filter(result => 
      result.place_name.toLowerCase().includes(query.toLowerCase())
    );
  };

  const searchLocations = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const results = await mockGeocoding(query);
      setSuggestions(results);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Geocoding error:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (query: string) => {
    setSearchQuery(query);
    
    // Clear existing timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Set new timeout for debounced search
    debounceTimeout.current = setTimeout(() => {
      searchLocations(query);
    }, 300);
  };

  const handleLocationSelect = (result: any) => {
    const location: Location = {
      address: result.place_name,
      city: result.context.find((c: any) => c.id === 'place')?.text || '',
      country: result.context.find((c: any) => c.id === 'country')?.text || '',
      lat: result.center[1],
      lng: result.center[0]
    };
    
    setSearchQuery(result.place_name);
    onChange(location);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // In a real app, you'd reverse geocode these coordinates
          const mockLocation: Location = {
            address: `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            city: 'Current City',
            country: 'Current Country',
            lat: latitude,
            lng: longitude
          };
          
          setSearchQuery(mockLocation.address);
          onChange(mockLocation);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="space-y-2">
        <label htmlFor="location-search">Event Location *</label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
            <Search className="w-4 h-4 text-muted-foreground" />
          </div>
          <Input
            id="location-search"
            placeholder="Search for a location..."
            value={searchQuery}
            onChange={(e) => handleInputChange(e.target.value)}
            className="pl-10"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
          className="text-xs"
        >
          <MapPin className="w-3 h-3 mr-1" />
          Use Current Location
        </Button>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-card border border-border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
          {suggestions.map((result, index) => (
            <button
              key={index}
              type="button"
              className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border last:border-b-0"
              onClick={() => handleLocationSelect(result)}
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm">{result.place_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected Location Display */}
      {value && (
        <div className="mt-3 p-3 bg-muted rounded-md">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">{value.address}</p>
              <p className="text-muted-foreground">
                {value.city}, {value.country}
              </p>
              <p className="text-xs text-muted-foreground">
                Coordinates: {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapboxLocationPicker;