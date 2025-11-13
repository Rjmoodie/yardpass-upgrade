import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load the Mapbox location picker
const MapboxLocationPicker = lazy(() => import('@/components/MapboxLocationPicker'));

interface LazyMapboxLocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number } | null) => void;
  className?: string;
}

/**
 * Lazy-loaded wrapper for MapboxLocationPicker
 * Only loads Mapbox when location picker is opened
 */
export function LazyMapboxLocationPicker(props: LazyMapboxLocationPickerProps) {
  return (
    <Suspense
      fallback={
        <div className={props.className || "w-full h-96"}>
          <Skeleton className="w-full h-full rounded-lg" />
          <p className="text-center text-sm text-muted-foreground mt-2">
            Loading map...
          </p>
        </div>
      }
    >
      <MapboxLocationPicker {...props} />
    </Suspense>
  );
}

export default LazyMapboxLocationPicker;

