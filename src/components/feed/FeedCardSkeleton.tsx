/**
 * Feed Card Skeleton Loader
 * 
 * Provides skeleton loading states for feed items (events and posts)
 * that match the actual layout to minimize layout shift.
 * 
 * @see PERF-009: Skeleton Loaders
 */

import { Skeleton } from '@/components/ui/skeleton';

export function FeedCardSkeleton() {
  return (
    <div 
      className="w-full bg-background border rounded-lg overflow-hidden"
      aria-busy="true"
      aria-label="Loading feed item..."
    >
      {/* Header: Avatar + User Info */}
      <div className="flex items-center gap-3 p-4">
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Media: Image or Video */}
      <Skeleton className="h-[400px] w-full rounded-none" />

      {/* Caption */}
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex gap-4">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div 
      className="w-full bg-background border rounded-lg overflow-hidden"
      aria-busy="true"
      aria-label="Loading event..."
    >
      {/* Event Cover Image */}
      <Skeleton className="h-48 w-full rounded-t-lg rounded-b-none" />

      {/* Event Details */}
      <div className="p-4 space-y-3">
        {/* Category Badge + Date */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Title */}
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-2/3" />

        {/* Location */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Organizer */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>

        {/* Stats */}
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* CTA Button */}
        <Skeleton className="h-10 w-full rounded-lg mt-3" />
      </div>
    </div>
  );
}

export function FeedLoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </div>
  );
}

