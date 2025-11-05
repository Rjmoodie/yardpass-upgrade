import { useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationCoords {
  lat: number;
  lng: number;
}

export function useLocation() {
  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async (): Promise<LocationCoords | null> => {
    setLoading(true);
    setError(null);

    try {
      // Request permission first
      const perm = await Geolocation.requestPermissions();
      
      if (perm.location !== 'granted') {
        throw new Error('Location permission denied');
      }

      // Get current position
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      setCoords(location);
      return location;

    } catch (err: any) {
      console.error('Location error:', err);
      const message = err?.message || 'Unable to get location';
      setError(message);
      return null;

    } finally {
      setLoading(false);
    }
  }, []);

  const clearLocation = useCallback(() => {
    setCoords(null);
    setError(null);
  }, []);

  return { 
    coords, 
    loading, 
    error, 
    requestLocation,
    clearLocation
  };
}





