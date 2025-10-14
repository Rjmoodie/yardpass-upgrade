import React, { useEffect, useRef, useState } from 'react';
import { Input } from './ui/input';
import { MapPin } from 'lucide-react';
import { BrandedSpinner } from './BrandedSpinner';
import { supabase } from '@/integrations/supabase/client';
import { YardpassSpinner } from '@/components/LoadingSpinner';

interface LocationAutocompleteProps {
  value: string;
  onChange: (location: string) => void;
  className?: string;
}

const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export function LocationAutocomplete({ value, onChange, className }: LocationAutocompleteProps) {
  const [searchQuery, setSearchQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Get Mapbox token from edge function
  const getMapboxToken = async (): Promise<string | null> => {
    if (mapboxToken) return mapboxToken;

    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) throw error;
      const token = data?.token;
      if (token) {
        setMapboxToken(token);
        return token;
      }
    } catch (error) {
      console.error('Failed to get Mapbox token:', error);
    }
    return null;
  };

  // Search for locations
  const searchLocations = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setLoading(true);
      const token = await getMapboxToken();
      if (!token) {
        throw new Error('Mapbox token not available');
      }

      const response = await fetch(
        `${MAPBOX_GEOCODING_URL}/${encodeURIComponent(query)}.json?access_token=${token}&limit=5&types=place,postcode,locality,neighborhood`
      );

      if (!response.ok) throw new Error('Failed to search locations');

      const data = await response.json();
      setSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Location search failed:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== value) {
        searchLocations(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (suggestion: any) => {
    const locationString = suggestion.place_name || '';
    setSearchQuery(locationString);
    onChange(locationString);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className || ''}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          placeholder="Search for a city or location..."
          className="pl-9 pr-9"
        />
        {loading && (
          <BrandedSpinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[300px] overflow-y-auto">
          <div className="p-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id || index}
                onClick={() => handleSelect(suggestion)}
                className="w-full text-left px-3 py-2 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-start gap-2"
              >
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {suggestion.text}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {suggestion.place_name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationAutocomplete;
