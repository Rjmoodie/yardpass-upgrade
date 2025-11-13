import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load chart components (292 KB)
const TimeSeriesChart = lazy(() => import('./TimeSeriesChart'));
const AttributionPie = lazy(() => import('./AttributionPie'));
const CreativeBreakdown = lazy(() => import('./CreativeBreakdown'));
const Sparkline = lazy(() => import('./Sparkline'));

const ChartSkeleton = () => (
  <div className="w-full space-y-2">
    <Skeleton className="h-64 w-full" />
    <div className="flex gap-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-20" />
    </div>
  </div>
);

/**
 * Lazy-loaded wrapper for TimeSeriesChart
 * Only loads Recharts library when charts are visible
 */
export function LazyTimeSeriesChart(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <TimeSeriesChart {...props} />
    </Suspense>
  );
}

export function LazyAttributionPie(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <AttributionPie {...props} />
    </Suspense>
  );
}

export function LazyCreativeBreakdown(props: any) {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <CreativeBreakdown {...props} />
    </Suspense>
  );
}

export function LazySparkline(props: any) {
  return (
    <Suspense fallback={<Skeleton className="h-8 w-full" />}>
      <Sparkline {...props} />
    </Suspense>
  );
}

