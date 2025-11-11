/**
 * Dashboard Skeleton Loaders
 * 
 * Provides skeleton loading states for dashboard components
 * to improve perceived performance.
 * 
 * @see PERF-009: Skeleton Loaders
 */

import { Skeleton } from '@/components/ui/skeleton';

export function StatCardSkeleton() {
  return (
    <div 
      className="border rounded-lg p-6 space-y-2"
      aria-busy="true"
      aria-label="Loading statistics..."
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-32 mt-2" />
    </div>
  );
}

export function DashboardStatsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  );
}

export function EventListItemSkeleton() {
  return (
    <div 
      className="border rounded-lg p-4 space-y-3"
      aria-busy="true"
      aria-label="Loading event..."
    >
      {/* Event Title + Status Badge */}
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Event Details */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* Metrics */}
      <div className="flex gap-6 pt-2">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-12" />
        </div>
      </div>
    </div>
  );
}

export function EventListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <EventListItemSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div 
      className="border rounded-lg p-6 space-y-4"
      aria-busy="true"
      aria-label="Loading chart..."
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div 
      className="border rounded-lg overflow-hidden"
      aria-busy="true"
      aria-label="Loading table..."
    >
      {/* Table Header */}
      <div className="border-b bg-muted/50 p-4">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Table Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard...">
      {/* Stats Grid */}
      <DashboardStatsGridSkeleton />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      {/* Recent Events */}
      <div className="border rounded-lg p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <EventListSkeleton count={3} />
      </div>
    </div>
  );
}

