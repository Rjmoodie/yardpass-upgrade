import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCampaign, getCampaignAnalytics } from '@/lib/api/campaigns';
import { addDays, subDays } from 'date-fns';
import CampaignAnalytics from '@/components/campaigns/CampaignAnalytics';
import type { AnalyticsPoint, AnalyticsTotals } from '@/types/campaigns';
import { AnalyticsErrorBoundary } from '@/analytics/components/AnalyticsErrorBoundary';
import { DegradedModeBanner } from '@/analytics/components/DegradedModeBanner';
import { DataFreshnessBadge } from '@/analytics/components/DataFreshnessBadge';

export default function CampaignAnalyticsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const campaignId = searchParams.get('id');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

  // Date range state (default: last 30 days)
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  // Redirect if no campaign ID
  useEffect(() => {
    if (!campaignId) {
      navigate('/campaigns');
    }
  }, [campaignId, navigate]);

  // Fetch campaign details first (to get org_id)
  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => getCampaign(campaignId!),
    enabled: !!campaignId,
  });

  // Fetch campaign analytics (requires campaign to be loaded first for org_id)
  const { 
    data: analyticsData, 
    isLoading: loadingAnalytics,
    error: analyticsError,
    isRefetching,
    refetch
  } = useQuery({
    queryKey: ['campaign-analytics', campaignId, campaign?.org_id, dateRange],
    queryFn: async () => {
      const result = await getCampaignAnalytics(
        campaignId!, 
        campaign!.org_id,  // Fixed: campaigns table uses org_id not organization_id
        dateRange.from, 
        dateRange.to
      );
      setLastRefreshTime(new Date());
      return result;
    },
    enabled: !!campaignId && !!campaign?.org_id,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
  });

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Transform data for CampaignAnalytics component
  const { campaigns, totals, series } = useMemo(() => {
    if (!campaign || !analyticsData) {
      return { 
        campaigns: [], 
        totals: null, 
        series: [] 
      };
    }

    // Create a campaigns array matching the structure from CampaignDashboard
    const campaigns = [{
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      budget: campaign.total_budget_credits || 0,  // Fixed: use correct field name
      spent: campaign.spent_credits || 0,          // Fixed: use campaign's spent, not analytics
      impressions: analyticsData.totals?.impressions || 0,
      clicks: analyticsData.totals?.clicks || 0,
      conversions: analyticsData.totals?.conversions || 0,
      startDate: campaign.start_date?.slice(0, 10),
      endDate: campaign.end_date?.slice(0, 10),
    }];

    // Use the totals from analytics
    const totals: AnalyticsTotals = analyticsData.totals || {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend_credits: 0,
    };

    // Use the time series data
    const series: AnalyticsPoint[] = analyticsData.series || [];

    return { campaigns, totals, series };
  }, [campaign, analyticsData]);

  if (loadingCampaign) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Campaign Not Found</h3>
              <p className="text-muted-foreground mb-4">
                The campaign you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button onClick={() => navigate('/campaigns')}>
                Back to Campaigns
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/campaigns')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Button>
        </div>

        {/* Campaign Title */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
            <p className="text-muted-foreground mt-1">
              Detailed analytics and performance metrics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DataFreshnessBadge 
              lastUpdated={lastRefreshTime}
              isRefreshing={isRefetching}
              isCached={!!analyticsError && !!analyticsData}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={loadingAnalytics || isRefetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Degraded Mode Banner */}
        {analyticsError && analyticsData && (
          <DegradedModeBanner
            lastUpdated={lastRefreshTime || new Date()}
            onRetry={handleManualRefresh}
            isRefreshing={isRefetching}
          />
        )}

        {/* Analytics Component with Error Boundary */}
        <AnalyticsErrorBoundary onRetry={handleManualRefresh}>
          <CampaignAnalytics
            campaigns={campaigns}
            totals={totals}
            series={series}
            isLoading={loadingAnalytics}
            error={analyticsError as Error | null}
            dateRange={dateRange}
          />
        </AnalyticsErrorBoundary>
      </div>
    </div>
  );
}

