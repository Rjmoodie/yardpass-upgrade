import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapboxEventMapProps {
  lat: number;
  lng: number;
  venue?: string;
  address?: string;
  className?: string;
}

const MapboxEventMap: React.FC<MapboxEventMapProps> = ({
  lat,
  lng,
  venue,
  address,
  className = "w-full h-56 rounded-lg"
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

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

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    // Set Mapbox access token
    mapboxgl.accessToken = mapboxToken;
    
    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12', // Less branded style
      center: [lng, lat],
      zoom: 15,
      pitch: 0, // Flat view reduces 3D ads
      bearing: 0,
      interactive: true,
      attributionControl: false, // We'll add custom minimal attribution
      logoPosition: 'bottom-left',
    });

    // Add marker
    const marker = new mapboxgl.Marker({
      color: 'hsl(var(--primary))',
      scale: 1.2,
    })
      .setLngLat([lng, lat])
      .addTo(map.current);

    // Add popup with venue info
    if (venue || address) {
      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        closeOnClick: false,
        className: 'mapbox-popup-custom',
      })
        .setLngLat([lng, lat])
        .setHTML(`
          <div class="p-2 text-sm">
            ${venue ? `<div class="font-semibold">${venue}</div>` : ''}
            ${address ? `<div class="text-muted-foreground">${address}</div>` : ''}
          </div>
        `);

      marker.setPopup(popup);
    }

    // Add minimal custom attribution
    map.current.addControl(
      new mapboxgl.AttributionControl({
        compact: true,
        customAttribution: '© YardPass'
      }),
      'bottom-right'
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
  }, [lat, lng, venue, address, mapboxToken]);

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
      
      {/* Custom styles for Mapbox popup */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .mapbox-popup-custom .mapbox-popup-content {
            background: hsl(var(--background));
            border: 1px solid hsl(var(--border));
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            color: hsl(var(--foreground));
          }
          .mapbox-popup-custom .mapbox-popup-tip {
            border-top-color: hsl(var(--background));
          }
        `
      }} />
    </div>
  );
};

export default MapboxEventMap;