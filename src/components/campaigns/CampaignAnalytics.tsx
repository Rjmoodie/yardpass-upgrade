import { lazy, Suspense, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { BarChart3, Calendar as CalendarIcon, Eye, MousePointerClick, TrendingUp, DollarSign, AlertCircle } from "lucide-react";
import { addDays, format } from "date-fns";
import LoadingSpinner from '@/components/dashboard/LoadingSpinner';
import type { AnalyticsPoint, AnalyticsTotals } from "@/types/campaigns";

// Lazy load chart component
const CampaignChart = lazy(() => import('./charts/CampaignChart'));

interface CampaignAnalyticsProps {
  campaigns: any[];
  totals: AnalyticsTotals | null;
  series: AnalyticsPoint[];
  isLoading?: boolean;
  error?: Error | null;
  dateRange: { from: Date; to: Date };
}

export default function CampaignAnalytics({ 
  campaigns, 
  totals, 
  series, 
  isLoading = false,
  error = null,
  dateRange 
}: CampaignAnalyticsProps) {
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <LoadingSpinner />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Analytics</h3>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no data
  if (!totals || (totals.impressions === 0 && totals.clicks === 0)) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Analytics Data Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Your campaigns haven't generated any impressions or clicks yet. 
              Analytics will appear here once your campaigns start running.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate CTR and other metrics
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.spend_credits / totals.clicks : 0;
  const cpm = totals.impressions > 0 ? (totals.spend_credits / totals.impressions) * 1000 : 0;
  
  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.impressions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.clicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              CTR: {ctr.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.conversions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {totals.clicks > 0 ? ((totals.conversions / totals.clicks) * 100).toFixed(2) : 0}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.spend_credits.toLocaleString()} credits</div>
            <p className="text-xs text-muted-foreground">
              CPM: {cpm.toFixed(2)} credits
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Over Time</CardTitle>
          <CardDescription>
            Campaign performance from {format(dateRange.from, 'MMM d, yyyy')} to {format(dateRange.to, 'MMM d, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="h-[300px] flex items-center justify-center"><LoadingSpinner /></div>}>
            <CampaignChart series={series} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Campaign Breakdown */}
      {campaigns && campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Breakdown</CardTitle>
            <CardDescription>{campaigns.length} campaign(s) in selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {campaigns.slice(0, 5).map((campaign: any) => (
                <div key={campaign.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {campaign.status === 'active' ? '● Active' : '○ Paused'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{campaign.spent?.toLocaleString() || 0} credits</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.budget?.toLocaleString() || 0} budget
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}