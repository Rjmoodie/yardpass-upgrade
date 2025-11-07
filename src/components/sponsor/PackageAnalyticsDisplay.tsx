/**
 * Package Analytics Display Component
 * 
 * Displays organizer-selected analytics to sponsors when they're browsing packages.
 * Shows data from either the current event or a reference event (past performance).
 */

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Target,
  BarChart3,
  Image as ImageIcon,
  Calendar,
  CheckCircle
} from 'lucide-react';
import { 
  AnalyticsShowcase, 
  EventAnalyticsData,
  ANALYTICS_METRIC_CONFIGS,
  formatAnalyticsValue,
  formatDateSafe,
  AnalyticsMetric,
  AnalyticsCategory
} from '@/types/analytics';
import { Separator } from '@/components/ui/separator';

interface PackageAnalyticsDisplayProps {
  analyticsShowcase?: AnalyticsShowcase | null;
  currentEventAnalytics?: EventAnalyticsData | null;
  referenceEventAnalytics?: EventAnalyticsData | null;
  referenceEventTitle?: string | null;
  referenceEventStartAt?: string | null;
  compact?: boolean;
}

export function PackageAnalyticsDisplay({
  analyticsShowcase,
  currentEventAnalytics,
  referenceEventAnalytics,
  referenceEventTitle,
  referenceEventStartAt,
  compact = false
}: PackageAnalyticsDisplayProps) {
  // Don't render if analytics are not enabled
  if (!analyticsShowcase?.enabled || !analyticsShowcase.metrics || analyticsShowcase.metrics.length === 0) {
    return null;
  }

  // Determine which analytics to use
  const analyticsData = analyticsShowcase.source === 'reference' 
    ? referenceEventAnalytics 
    : currentEventAnalytics;

  // If no data available, show a message
  if (!analyticsData && !analyticsShowcase.customStats?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground text-center">
            Analytics will be available after the event completes
          </p>
        </CardContent>
      </Card>
    );
  }

  const getCategoryIcon = (category: AnalyticsCategory | string) => {
    switch (category) {
      case 'attendance': return Users;
      case 'engagement': return TrendingUp;
      case 'demographics': return Target;
      case 'financial': return DollarSign;
      case 'sponsor': return BarChart3;
      case 'media': return ImageIcon;
      default: return BarChart3;
    }
  };

  // Map analytics data to displayable values
  const getMetricValue = (metricId: AnalyticsMetric): string => {
    if (!analyticsData) return 'N/A';
    
    const config = ANALYTICS_METRIC_CONFIGS[metricId];
    // Fallback if config doesn't exist (protects against bad metric IDs)
    if (!config) return 'N/A';
    
    const value = analyticsData[metricId as keyof EventAnalyticsData];
    
    return formatAnalyticsValue(value, config.format);
  };

  // Format description text with safe date handling
  const headerDescription = useMemo(() => {
    if (analyticsShowcase.source === 'reference' && referenceEventTitle) {
      const dateStr = referenceEventStartAt ? ` (${formatDateSafe(referenceEventStartAt)})` : '';
      return `Based on ${referenceEventTitle}${dateStr}`;
    }
    return 'Current event metrics';
  }, [analyticsShowcase.source, referenceEventTitle, referenceEventStartAt]);

  if (compact) {
    // In compact mode, if there's no data and no custom stats, don't show anything
    if (!analyticsData && !analyticsShowcase.customStats?.length) {
      return null;
    }

    // Compact view - show only top 3-4 metrics (or just custom stats)
    const topMetrics = analyticsShowcase.metrics.slice(0, 4);
    
    return (
      <div className="grid grid-cols-2 gap-2">
        {analyticsData && topMetrics.map(metricId => {
          const config = ANALYTICS_METRIC_CONFIGS[metricId];
          if (!config) return null; // Skip invalid metric IDs
          
          const Icon = getCategoryIcon(config.category);
          
          return (
            <div key={metricId} className="flex items-center gap-2 rounded-lg border bg-card p-2">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{config.label}</p>
                <p className="text-sm font-semibold">{getMetricValue(metricId)}</p>
              </div>
            </div>
          );
        })}
        {analyticsData && analyticsShowcase.metrics.length > 4 && (
          <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-2 text-xs text-muted-foreground">
            +{analyticsShowcase.metrics.length - 4} more
          </div>
        )}
        {/* Show custom stats in compact mode if no regular metrics data */}
        {!analyticsData && analyticsShowcase.customStats?.slice(0, 4).map((stat, index) => (
          <div key={index} className="flex items-center gap-2 rounded-lg border bg-card p-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
              <p className="text-sm font-semibold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Full view - show all metrics organized by category (memoized)
  const metricsByCategory = useMemo(() => {
    const map: Record<string, AnalyticsMetric[]> = {};
    analyticsShowcase.metrics.forEach(metricId => {
      const config = ANALYTICS_METRIC_CONFIGS[metricId];
      if (!config) return; // Skip invalid metric IDs
      if (!map[config.category]) {
        map[config.category] = [];
      }
      map[config.category].push(metricId);
    });
    return map;
  }, [analyticsShowcase.metrics]);

  // Reusable metric tile component
  const MetricTile = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-lg border bg-card p-3 hover:border-primary/50 transition-colors">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Analytics
            </CardTitle>
            <CardDescription>
              {headerDescription}
            </CardDescription>
          </div>
          <Badge variant="success" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Verified Data
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(metricsByCategory).map(([category, metricIds]) => {
          if (metricIds.length === 0) return null;
          
          const Icon = getCategoryIcon(category);
          
          return (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold capitalize">{category}</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {metricIds.map(metricId => {
                  const config = ANALYTICS_METRIC_CONFIGS[metricId];
                  if (!config) return null; // Skip invalid metric IDs
                  
                  return (
                    <MetricTile 
                      key={metricId}
                      label={config.label}
                      value={getMetricValue(metricId)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Custom Stats */}
        {analyticsShowcase.customStats && analyticsShowcase.customStats.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Additional Insights</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {analyticsShowcase.customStats.map((stat, index) => (
                  <MetricTile 
                    key={index}
                    label={stat.label}
                    value={stat.value}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Data timestamp with safe date formatting */}
        {analyticsData?.calculated_at && formatDateSafe(analyticsData.calculated_at, 'datetime') && (
          <p className="text-xs text-muted-foreground text-center">
            <Calendar className="h-3 w-3 inline mr-1" />
            Data as of {formatDateSafe(analyticsData.calculated_at, 'datetime')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

