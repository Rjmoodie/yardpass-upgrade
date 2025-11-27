/**
 * Degraded Mode Banner
 * 
 * Shows when analytics is displaying cached data due to query failure
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface DegradedModeBannerProps {
  /** Timestamp when cached data was last updated */
  lastUpdated: Date | null;
  /** Callback to retry loading fresh data */
  onRetry?: () => void;
  /** Whether a refresh is in progress */
  isRefreshing?: boolean;
}

export function DegradedModeBanner({ 
  lastUpdated, 
  onRetry,
  isRefreshing = false 
}: DegradedModeBannerProps) {
  if (!lastUpdated) {
    return null;
  }

  const timeAgo = lastUpdated.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
      <AlertTitle className="text-amber-900 dark:text-amber-200">
        Showing Cached Data
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-300">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p>
            We couldn't refresh the analytics data. Showing data from{' '}
            <span className="font-semibold">{timeAgo}</span>. 
            Latest refresh temporarily unavailable.
          </p>
          {onRetry && (
            <Button
              onClick={onRetry}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
              className="border-amber-600 text-amber-900 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-200 dark:hover:bg-amber-950/40"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Refresh
                </>
              )}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

