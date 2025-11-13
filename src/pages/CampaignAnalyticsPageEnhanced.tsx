import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { getCampaign } from '@/lib/api/campaigns';
import { subDays, format } from 'date-fns';

// Enhanced Analytics Hook
import { useCampaignAnalyticsEnhanced } from '@/hooks/useCampaignAnalyticsEnhanced';

// Enhanced Analytics Components
import { KpiCardEnhanced } from '@/analytics/components/KpiCardEnhanced';
import { PacingPredictor } from '@/analytics/components/PacingPredictor';
import { ViewabilityCard } from '@/analytics/components/ViewabilityCard';
import { MetricsBar } from '@/analytics/components/MetricsBar';
import { LazyTimeSeriesChart, LazyCreativeBreakdown, LazyAttributionPie } from '@/analytics/components/LazyCharts';
import { AiSpendOptimizer } from '@/components/ai/AiSpendOptimizer';

export default function CampaignAnalyticsPageEnhanced() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const campaignId = searchParams.get('id');

  // Date range selector (7d, 14d, 30d)
  const [selectedDays, setSelectedDays] = useState<7 | 14 | 30>(7);
  
  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const to = format(new Date(), 'yyyy-MM-dd');
    const from = format(subDays(new Date(), selectedDays), 'yyyy-MM-dd');
    return { from, to };
  }, [selectedDays]);

  // Redirect if no campaign ID
  if (!campaignId) {
    navigate('/campaigns');
    return null;
  }

  // Fetch campaign details
  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => getCampaign(campaignId!),
    enabled: !!campaignId,
  });

  // Fetch enhanced analytics data
  const {
    daily,
    viewability,
    creatives,
    attribution,
    comparison,
    totals,
    isLoading: loadingAnalytics,
    error: analyticsError,
  } = useCampaignAnalyticsEnhanced({
    campaignId: campaignId!,
    dateRange,
    enabled: !!campaignId,
  });

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
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Campaign Not Found</h3>
          <p className="text-muted-foreground mb-4">
            The campaign you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate('/campaigns')}>
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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

          {/* Date Range Selector */}
          <div className="flex items-center gap-2 rounded-lg bg-muted p-1">
            <Button
              variant={selectedDays === 7 ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedDays(7)}
            >
              7d
            </Button>
            <Button
              variant={selectedDays === 14 ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedDays(14)}
            >
              14d
            </Button>
            <Button
              variant={selectedDays === 30 ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedDays(30)}
            >
              30d
            </Button>
          </div>
        </div>

        {/* Campaign Title */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaign Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Campaign ID: {campaignId?.slice(0, 8)}...
          </p>
        </div>

        {/* Enhanced KPI Cards with Period Comparison */}
        {comparison && (
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCardEnhanced
              title="Impressions"
              currentValue={comparison.impressions.current_value}
              previousValue={comparison.impressions.previous_value}
              format={(n) => n.toLocaleString()}
            />
            <KpiCardEnhanced
              title="Clicks"
              currentValue={comparison.clicks.current_value}
              previousValue={comparison.clicks.previous_value}
              format={(n) => n.toLocaleString()}
            />
            <KpiCardEnhanced
              title="Conversions"
              currentValue={comparison.conversions.current_value}
              previousValue={comparison.conversions.previous_value}
              format={(n) => n.toLocaleString()}
            />
            <KpiCardEnhanced
              title="Spend"
              currentValue={comparison.spend.current_value}
              previousValue={comparison.spend.previous_value}
              format={(n) => n.toFixed(2)}
              suffix="credits"
            />
          </div>
        )}

        {/* AI Spend Optimizer */}
        {campaignId && <AiSpendOptimizer campaignId={campaignId} />}

        {/* Budget Pacing Predictor */}
        {campaign && daily && (
          <PacingPredictor
            totalBudget={campaign.total_budget_credits || 0}
            currentSpend={campaign.spent_credits || 0}
            dailyData={daily}
            campaignStartDate={campaign.start_date}
            campaignEndDate={campaign.end_date || undefined}
          />
        )}

        {/* Metrics Bar */}
        <MetricsBar totals={totals} />

        {/* Viewability Metrics */}
        <ViewabilityCard viewability={viewability} />

        {/* Time Series Chart */}
        {daily && daily.length > 0 && (
          <LazyTimeSeriesChart data={daily} />
        )}

        {/* Creative Performance */}
        {creatives && creatives.length > 0 && (
          <LazyCreativeBreakdown creatives={creatives} />
        )}

        {/* Attribution Mix */}
        {attribution && attribution.length > 0 && totals.conversions > 0 && (
          <LazyAttributionPie data={attribution} />
        )}

        {/* Loading State */}
        {loadingAnalytics && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading analytics data...</p>
          </div>
        )}

        {/* Error State */}
        {analyticsError && (
          <div className="text-center py-12 text-red-500">
            <p>Error loading analytics data</p>
            <p className="text-sm">{String(analyticsError)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
