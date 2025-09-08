import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { openMaps } from '@/lib/maps';

interface MapCardProps {
  address: string;
  title?: string;
  height?: number;
  themeOverride?: 'light' | 'dark';
  styleUrl?: string;
}

export default function MapCard({ 
  address, 
  title, 
  height = 280, 
  themeOverride,
  styleUrl 
}: MapCardProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Get Mapbox token from Supabase function or show input
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/get-mapbox-token');
        if (response.ok) {
          const { token } = await response.json();
          setMapboxToken(token);
        } else {
          // Fallback to showing token input
          setShowTokenInput(true);
        }
      } catch (error) {
        // Show token input if API fails
        setShowTokenInput(true);
      }
    })();
  }, []);

  // Initialize map when token is available
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !address) return;

    mapboxgl.accessToken = mapboxToken;

    // Geocode the address first
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}`;
    
    fetch(geocodeUrl)
      .then(response => response.json())
      .then(data => {
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;
          
          // Determine map style
          const defaultStyle = themeOverride === 'dark' 
            ? 'mapbox://styles/mapbox/dark-v11' 
            : 'mapbox://styles/mapbox/light-v11';
          
          map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: styleUrl || defaultStyle,
            center: [lng, lat],
            zoom: 15,
          });

          // Add marker
          new mapboxgl.Marker({
            color: '#3b82f6'
          })
            .setLngLat([lng, lat])
            .addTo(map.current);

          // Add navigation controls
          map.current.addControl(
            new mapboxgl.NavigationControl(),
            'top-right'
          );
        }
      })
      .catch(error => {
        console.error('Geocoding error:', error);
      });

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, address, themeOverride, styleUrl]);

  const handleTokenSubmit = () => {
    if (tokenInput.trim()) {
      setMapboxToken(tokenInput.trim());
      setShowTokenInput(false);
    }
  };

  if (showTokenInput) {
    return (
      <div 
        className="bg-muted rounded-lg flex flex-col items-center justify-center gap-4 p-6"
        style={{ height }}
      >
        <p className="text-sm text-muted-foreground text-center">
          To display the map, please enter your Mapbox public token.
          <br />
          Get one at <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="underline">mapbox.com</a>
        </p>
        <div className="flex gap-2 w-full max-w-md">
          <input
            type="text"
            placeholder="pk.eyJ..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-md text-sm"
          />
          <Button onClick={handleTokenSubmit} size="sm">
            Load Map
          </Button>
        </div>
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div 
        className="bg-muted animate-pulse rounded-lg flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-sm text-muted-foreground">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden shadow-sm border">
      <div 
        ref={mapContainer} 
        className="w-full" 
        style={{ height }} 
      />
      
      {/* Get Directions Button */}
      <div className="absolute bottom-4 right-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openMaps(address, title)}
          className="shadow-lg"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Directions
        </Button>
      </div>
    </div>
  );
}