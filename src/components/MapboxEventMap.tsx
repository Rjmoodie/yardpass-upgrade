import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { ExternalLink, Navigation } from 'lucide-react';

interface MapboxEventMapProps {
  lat: number;
  lng: number;
  venue?: string;
  address?: string;
  city?: string;
  country?: string;
  className?: string;
}

const MapboxEventMap: React.FC<MapboxEventMapProps> = ({
  lat,
  lng,
  venue,
  address,
  city,
  country,
  className = "w-full h-56 rounded-lg"
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [resolved, setResolved] = useState<{ lat: number; lng: number } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Fetch Mapbox token from Supabase edge function
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error) {
          console.error('Error calling Mapbox token function:', error);
          return;
        }
        
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          console.error('No token returned from Mapbox function');
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
      }
    };

    fetchMapboxToken();
  }, []);

  // Debug incoming props and validate coordinates
  useEffect(() => {
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      console.warn('[MapboxEventMap] Invalid coords', { lat, lng });
    }
    console.debug('[MapboxEventMap] props', { lat, lng, venue, address, city, country });
  }, [lat, lng, venue, address, city, country]);

  // Detect and respond to theme changes
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    // Initial check
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    // Set Mapbox access token
    mapboxgl.accessToken = mapboxToken;
    
    // Choose map style based on theme
    const mapStyle = isDarkMode 
      ? 'mapbox://styles/mapbox/dark-v11' 
      : 'mapbox://styles/mapbox/light-v11';
    
    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [lng, lat],
      zoom: 15,
      pitch: 0,
      bearing: 0,
      interactive: true,
      attributionControl: false,
      logoPosition: 'bottom-left',
    });

    // Add marker (without popup since we have the overlay at the top)
    const marker = new mapboxgl.Marker({
      color: 'hsl(var(--primary))',
      scale: 1.2,
    })
      .setLngLat([lng, lat])
      .addTo(map.current);

    // Add ultra-compact attribution
    map.current.addControl(
      new mapboxgl.AttributionControl({
        compact: true,
      }),
      'bottom-left'
    );

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: false,
        showZoom: true,
        showCompass: false,
      }),
      'top-right'
    );

    // Map loaded event
    map.current.on('load', () => {
      setMapLoaded(true);
      
      // Add subtle 3D buildings if available
      try {
        if (map.current?.getLayer('building')) {
          map.current.setPaintProperty('building', 'fill-extrusion-opacity', 0.3);
        }
      } catch (error) {
        console.warn('Could not set building properties:', error);
      }
    });

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, [lat, lng, venue, address, mapboxToken, isDarkMode]);

  // Open external map with precise coordinates
  const openExternalMap = () => {
    const location = `${lat},${lng}`;
    const query = venue || address || location;
    const encodedQuery = encodeURIComponent(query);
    
    // Use coordinates for maximum accuracy
    const userAgent = navigator.userAgent;
    
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      // iOS - Apple Maps with coordinates
      const appleUrl = `maps://maps.apple.com/?ll=${lat},${lng}&q=${encodedQuery}`;
      const googleUrl = `https://maps.google.com/maps?q=${lat},${lng}`;
      
      try {
        window.location.href = appleUrl;
        setTimeout(() => {
          window.open(googleUrl, '_blank');
        }, 500);
      } catch {
        window.open(googleUrl, '_blank');
      }
    } else if (/Android/.test(userAgent)) {
      // Android - Google Maps with coordinates
      const googleUrl = `geo:${lat},${lng}?q=${lat},${lng}(${encodedQuery})`;
      const fallbackUrl = `https://maps.google.com/maps?q=${lat},${lng}`;
      
      try {
        window.location.href = googleUrl;
        setTimeout(() => {
          window.open(fallbackUrl, '_blank');
        }, 500);
      } catch {
        window.open(fallbackUrl, '_blank');
      }
    } else {
      // Desktop - Google Maps with coordinates
      const googleUrl = `https://maps.google.com/maps?q=${lat},${lng}`;
      window.open(googleUrl, '_blank');
    }
  };

  if (!mapboxToken) {
    return (
      <div className={`${className} bg-gradient-to-br from-muted via-muted to-muted/50 animate-pulse flex items-center justify-center`}>
        <div className="text-sm text-muted-foreground">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div 
        ref={mapContainer} 
        className={`${className} ${mapLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
      />
      {!mapLoaded && (
        <div className={`absolute inset-0 ${className} bg-gradient-to-br from-muted via-muted to-muted/50 animate-pulse flex items-center justify-center`}>
          <div className="text-sm text-muted-foreground">Loading map...</div>
        </div>
      )}
      
      {/* Address overlay - responsive and theme-aware */}
      {(address || city || country || venue) && (
        <div className="absolute top-2 left-2 right-16 sm:top-3 sm:left-3 sm:right-auto sm:max-w-[75%]">
          <div className="px-3 py-2 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-lg">
            <div className="text-sm font-semibold truncate text-foreground">{venue || 'Location'}</div>
            <div className="text-xs text-foreground/70 truncate">
              {address || [city, country].filter(Boolean).join(', ')}
            </div>
          </div>
        </div>
      )}
      
      {/* Directions Button - responsive */}
      {mapLoaded && (
        <div className="absolute bottom-3 right-2 sm:bottom-4 sm:right-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={openExternalMap}
            className="shadow-lg backdrop-blur-md bg-card/95 border border-border hover:bg-card/100 transition-all duration-200 text-foreground"
          >
            <Navigation className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Directions</span>
          </Button>
        </div>
      )}
      
      {/* Custom styles for minimal attribution */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .mapboxgl-ctrl-attrib {
            opacity: 0.4;
            font-size: 9px !important;
            padding: 0 4px !important;
            background: rgba(255, 255, 255, 0.5) !important;
            backdrop-filter: blur(4px);
          }
          .mapboxgl-ctrl-attrib:hover {
            opacity: 0.8;
          }
          .mapboxgl-ctrl-logo {
            opacity: 0.3 !important;
            width: 65px !important;
            height: 18px !important;
          }
          .mapboxgl-ctrl-logo:hover {
            opacity: 0.6 !important;
          }
        `
      }} />
    </div>
  );
};

export default MapboxEventMap;