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

// Mapbox API configuration
const MAPBOX_TOKEN = 'pk.eyJ1IjoiaG90cm9kMjUiLCJhIjoiY21lZm9sODBoMHdnaDJycHg5dmQyaGV3YSJ9.RoCyY_SXikylZK2sD35oMQ';
const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export function MapboxLocationPicker({ value, onChange, className }: MapboxLocationPickerProps) {
  const [searchQuery, setSearchQuery] = useState(value?.address || '');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimeout = useRef<NodeJS.Timeout>();

  const searchLocations = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${MAPBOX_GEOCODING_URL}/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=place,postcode,locality,neighborhood,address`
      );
      
      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }
      
      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Geocoding error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
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
    // Extract location information from Mapbox response
    const location: Location = {
      address: result.place_name,
      city: result.context?.find((c: any) => c.id.includes('place'))?.text || 
            result.context?.find((c: any) => c.id.includes('locality'))?.text || '',
      country: result.context?.find((c: any) => c.id.includes('country'))?.text || '',
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
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            // Reverse geocode the coordinates
            const response = await fetch(
              `${MAPBOX_GEOCODING_URL}/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}&types=address,poi`
            );
            
            if (response.ok) {
              const data = await response.json();
              if (data.features && data.features.length > 0) {
                handleLocationSelect(data.features[0]);
              } else {
                // Fallback if reverse geocoding fails
                const fallbackLocation: Location = {
                  address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                  city: 'Current Location',
                  country: '',
                  lat: latitude,
                  lng: longitude
                };
                setSearchQuery(fallbackLocation.address);
                onChange(fallbackLocation);
              }
            }
          } catch (error) {
            console.error('Reverse geocoding error:', error);
            // Fallback to coordinates only
            const fallbackLocation: Location = {
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
              city: 'Current Location',
              country: '',
              lat: latitude,
              lng: longitude
            };
            setSearchQuery(fallbackLocation.address);
            onChange(fallbackLocation);
          } finally {
            setLoading(false);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLoading(false);
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