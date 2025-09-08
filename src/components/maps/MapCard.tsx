import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import { openMaps } from '@/lib/maps';
import { supabase } from '@/integrations/supabase/client';

interface MapCardProps {
  address: string;
  title?: string;
  height?: number;
  themeOverride?: 'light' | 'dark';
  styleUrl?: string;
  showControls?: boolean;
}

export default function MapCard({ 
  address, 
  title, 
  height = 280, 
  themeOverride,
  styleUrl,
  showControls = false
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
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) throw error;
        
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          // Fallback to showing token input
          setShowTokenInput(true);
        }
      } catch (error) {
        console.error('Failed to get Mapbox token:', error);
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
          
          // Custom style - elegant dark theme that matches app
          const customStyle = themeOverride === 'light' 
            ? 'mapbox://styles/mapbox/light-v11'
            : 'mapbox://styles/mapbox/dark-v11';
          
          map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: styleUrl || customStyle,
            center: [lng, lat],
            zoom: 15,
            pitch: 45, // Add 3D perspective
            bearing: 0,
            antialias: true, // Smooth edges
            fadeDuration: 300, // Smooth transitions
          });

          // Wait for style to load before customizing
          map.current.on('style.load', () => {
            // Add subtle glow effect to buildings
            if (map.current?.getLayer('building')) {
              map.current.setPaintProperty('building', 'fill-extrusion-opacity', 0.8);
            }
          });

          // Custom marker with your brand colors
          const markerElement = document.createElement('div');
          markerElement.innerHTML = `
            <div class="relative">
              <div class="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
              <div class="relative w-8 h-8 bg-primary rounded-full border-2 border-background shadow-lg flex items-center justify-center">
                <svg class="w-4 h-4 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                </svg>
              </div>
            </div>
          `;
          
          new mapboxgl.Marker(markerElement)
            .setLngLat([lng, lat])
            .addTo(map.current);

          // Add custom navigation controls with your theme (optional)
          if (showControls) {
            const nav = new mapboxgl.NavigationControl({
              showCompass: true,
              showZoom: true,
              visualizePitch: true
            });
            map.current.addControl(nav, 'top-right');

            // Add scale control
            map.current.addControl(new mapboxgl.ScaleControl({
              maxWidth: 100,
              unit: 'metric'
            }), 'bottom-left');
          }

          // Smooth flyTo animation on load
          setTimeout(() => {
            map.current?.flyTo({
              center: [lng, lat],
              zoom: 16,
              pitch: 60,
              duration: 2000,
              essential: true
            });
          }, 500);

          // Add popup with location info
          const popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'custom-popup'
          })
          .setLngLat([lng, lat])
          .setHTML(`
            <div class="p-3 bg-card border border-border rounded-lg shadow-lg">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 bg-primary rounded-full"></div>
                <p class="text-sm font-medium text-foreground">${title || address}</p>
              </div>
            </div>
          `)
          .addTo(map.current);
        }
      })
      .catch(error => {
        console.error('Geocoding error:', error);
      });

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, address, themeOverride, styleUrl, title]);

  const handleTokenSubmit = () => {
    if (tokenInput.trim()) {
      setMapboxToken(tokenInput.trim());
      setShowTokenInput(false);
    }
  };

  if (showTokenInput) {
    return (
      <div 
        className="bg-gradient-to-br from-muted to-muted/50 rounded-xl border border-border/50 flex flex-col items-center justify-center gap-6 p-8 backdrop-blur-sm"
        style={{ height }}
      >
        <div className="flex items-center gap-3 text-primary">
          <MapPin className="w-6 h-6" />
          <h3 className="text-lg font-medium">Map Setup Required</h3>
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            To display the interactive map, please enter your Mapbox public token.
          </p>
          <p className="text-xs text-muted-foreground">
            Get one at <a href="https://mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">mapbox.com</a>
          </p>
        </div>
        
        <div className="flex gap-3 w-full max-w-sm">
          <input
            type="text"
            placeholder="pk.eyJ..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 px-4 py-2 bg-input-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
          <Button onClick={handleTokenSubmit} className="shadow-sm">
            <Navigation className="w-4 h-4 mr-2" />
            Load Map
          </Button>
        </div>
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div 
        className="bg-gradient-to-br from-card to-muted/30 rounded-xl border border-border/50 flex items-center justify-center backdrop-blur-sm"
        style={{ height }}
      >
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Loading interactive map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden shadow-card border border-border/50 bg-card">
      {/* Map Container */}
      <div 
        ref={mapContainer} 
        className="w-full relative"
        style={{ height }} 
      />
      
      {/* Gradient Overlay for better button visibility */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/20 to-transparent"></div>
      </div>
      
      {/* Action Buttons */}
      <div className="absolute bottom-4 right-4 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openMaps(address, title)}
          className="shadow-lg backdrop-blur-sm bg-card/90 border border-border/50 hover:bg-card transition-all duration-200"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Directions
        </Button>
      </div>
      
      {/* Location Badge */}
      {title && (
        <div className="absolute top-4 left-4">
          <div className="bg-card/90 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-foreground">{title}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}