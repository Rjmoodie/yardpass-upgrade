/**
 * Data Freshness Badge
 * 
 * Shows when analytics data was last updated and indicates if it's stale
 */

import { Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface DataFreshnessBadgeProps {
  lastUpdated: Date | null;
  isRefreshing?: boolean;
  isCached?: boolean;
}

export function DataFreshnessBadge({ 
  lastUpdated, 
  isRefreshing = false,
  isCached = false 
}: DataFreshnessBadgeProps) {
  if (!lastUpdated) {
    return null;
  }

  const isStale = Date.now() - lastUpdated.getTime() > 5 * 60 * 1000; // 5 minutes
  const timeAgo = formatDistanceToNow(lastUpdated, { addSuffix: true });

  if (isCached) {
    return (
      <Badge variant="secondary" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        <span>Showing data from {timeAgo}</span>
        <span className="text-xs opacity-70">(Latest refresh unavailable)</span>
      </Badge>
    );
  }

  if (isRefreshing) {
    return (
      <Badge variant="default" className="gap-1">
        <Clock className="h-3 w-3 animate-spin" />
        <span>Refreshing...</span>
      </Badge>
    );
  }

  return (
    <Badge variant={isStale ? "secondary" : "default"} className="gap-1">
      <Clock className="h-3 w-3" />
      <span>Updated {timeAgo}</span>
    </Badge>
  );
}

