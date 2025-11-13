import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load the heavy Mapbox component (1566 KB)
const MapboxEventMap = lazy(() => import('@/components/MapboxEventMap'));

interface LazyMapboxEventMapProps {
  lat: number;
  lng: number;
  venue?: string;
  address?: string;
  city?: string;
  country?: string;
  className?: string;
}

/**
 * Lazy-loaded wrapper for MapboxEventMap
 * Only loads the 1566 KB Mapbox library when the map is actually rendered
 */
export function LazyMapboxEventMap(props: LazyMapboxEventMapProps) {
  return (
    <Suspense
      fallback={
        <div className={props.className || "w-full h-56 rounded-lg"}>
          <Skeleton className="w-full h-full" />
        </div>
      }
    >
      <MapboxEventMap {...props} />
    </Suspense>
  );
}

export default LazyMapboxEventMap;

