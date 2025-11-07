/**
 * Shared PackageGrid Component
 * 
 * Reusable grid display for sponsorship packages
 * Used by both SponsorMarketplace and MarketplacePage
 * 
 * Features:
 * - Responsive grid layout
 * - Loading skeletons
 * - Empty state
 * - Package cards with analytics
 * - Customizable actions
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Calendar, DollarSign } from 'lucide-react';
import { PackageAnalyticsDisplay } from '@/components/sponsor/PackageAnalyticsDisplay';

export interface PackageGridItem {
  id: string;
  title: string;
  event_title: string;
  event_start_at: string | null;
  event_city?: string | null;
  event_category?: string | null;
  event_cover_image_url?: string | null;
  price_cents: number;
  inventory: number;
  sold: number;
  benefits?: string[] | any;
  analytics_showcase?: any;
  current_event_analytics?: any;
  reference_event_analytics?: any;
  reference_event_title?: string | null;
  reference_event_start_at?: string | null;
  organizer_name?: string | null;
  organizer_logo?: string | null;
}

export interface PackageGridAction {
  label: string;
  onClick: (item: PackageGridItem) => void;
  disabled?: (item: PackageGridItem) => boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
}

interface PackageGridProps {
  items: PackageGridItem[];
  loading: boolean;
  primaryAction: PackageGridAction;
  secondaryAction?: PackageGridAction;
  emptyMessage?: string;
  emptyDescription?: string;
  compactAnalytics?: boolean;
}

export function PackageGrid({
  items,
  loading,
  primaryAction,
  secondaryAction,
  emptyMessage = 'No sponsorship opportunities found',
  emptyDescription = 'Try adjusting your filters or search terms.',
  compactAnalytics = true,
}: PackageGridProps) {
  // Loading skeleton
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
                <div className="h-8 bg-muted rounded mt-4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">{emptyMessage}</h3>
          <p className="text-muted-foreground">{emptyDescription}</p>
        </CardContent>
      </Card>
    );
  }

  // Package grid
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item) => {
        const spotsRemaining = item.inventory - item.sold;
        const isSoldOut = spotsRemaining === 0;
        const isLowInventory = spotsRemaining > 0 && spotsRemaining <= 3;

        return (
          <Card key={item.id} className="hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden">
            {/* Event Banner */}
            {item.event_cover_image_url && (
              <div className="relative h-32 w-full overflow-hidden bg-muted">
                <img
                  src={item.event_cover_image_url}
                  alt={item.event_title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
            )}

            <CardHeader className={item.event_cover_image_url ? 'pt-3' : ''}>
              <CardTitle className="text-base line-clamp-2">{item.event_title}</CardTitle>
              
              {/* Organizer name */}
              {item.organizer_name && (
                <p className="text-xs text-muted-foreground">
                  by {item.organizer_name}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {item.event_start_at
                    ? new Date(item.event_start_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'TBD'}
                </div>
                {item.event_city && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {item.event_city}
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4 flex-1 flex flex-col">
              {/* Package info */}
              <div className="flex items-center justify-between">
                <Badge variant="brand">{item.title}</Badge>
                <div className="flex items-center gap-1 font-semibold text-lg">
                  <DollarSign className="h-4 w-4" />
                  {(item.price_cents / 100).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>

              {/* Category */}
              {item.event_category && (
                <Badge variant="neutral" size="sm">
                  {item.event_category}
                </Badge>
              )}

              {/* Inventory status */}
              <div className="text-sm">
                {isSoldOut ? (
                  <Badge variant="danger" size="sm">
                    Sold Out
                  </Badge>
                ) : isLowInventory ? (
                  <Badge variant="warning" size="sm">
                    Only {spotsRemaining} spot{spotsRemaining !== 1 ? 's' : ''} left
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">
                    {spotsRemaining} of {item.inventory} spots available
                  </span>
                )}
              </div>

              {/* Benefits */}
              {item.benefits && Array.isArray(item.benefits) && item.benefits.length > 0 && (
                <div className="text-xs">
                  <div className="font-medium mb-1">Benefits include:</div>
                  <div className="text-muted-foreground space-y-0.5">
                    {item.benefits.slice(0, 3).map((benefit, index) => (
                      <div key={index} className="flex items-start gap-1">
                        <span className="text-primary">•</span>
                        <span className="line-clamp-1">{String(benefit)}</span>
                      </div>
                    ))}
                    {item.benefits.length > 3 && (
                      <div className="text-muted-foreground italic">
                        +{item.benefits.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Analytics Showcase */}
              {item.analytics_showcase && (
                <PackageAnalyticsDisplay
                  analyticsShowcase={item.analytics_showcase}
                  currentEventAnalytics={item.current_event_analytics}
                  referenceEventAnalytics={item.reference_event_analytics}
                  referenceEventTitle={item.reference_event_title}
                  referenceEventStartAt={item.reference_event_start_at}
                  compact={compactAnalytics}
                />
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-auto mt-auto">
                <Button
                  size="sm"
                  variant={primaryAction.variant || 'default'}
                  onClick={() => primaryAction.onClick(item)}
                  disabled={
                    primaryAction.disabled ? primaryAction.disabled(item) : false
                  }
                  className="flex-1"
                >
                  {isSoldOut && primaryAction.label === 'Buy Now' ? 'Sold Out' : primaryAction.label}
                </Button>
                {secondaryAction && (
                  <Button
                    size="sm"
                    variant={secondaryAction.variant || 'outline'}
                    onClick={() => secondaryAction.onClick(item)}
                    disabled={
                      secondaryAction.disabled ? secondaryAction.disabled(item) : false
                    }
                  >
                    {secondaryAction.label}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

