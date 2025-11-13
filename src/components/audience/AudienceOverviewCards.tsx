/**
 * Audience Overview Cards
 * Top-level metrics for audience intelligence
 */

import React from 'react';
import { KPICard, Sparkline } from '@/components/analytics/KPICard';
import { Users, Activity, ShoppingCart, DollarSign, Smartphone, Monitor } from 'lucide-react';
import { formatMetric } from '@/types/analytics';
import type { AudienceOverview } from '@/hooks/useAudienceIntelligence';

interface AudienceOverviewCardsProps {
  data: AudienceOverview | null;
  loading: boolean;
  comparison?: any;  // Period comparison data
  targets?: Record<string, number>;
  sparklines?: Record<string, number[]>;
}

export function AudienceOverviewCards({
  data,
  loading,
  comparison,
  targets,
  sparklines
}: AudienceOverviewCardsProps) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-32 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Visitors */}
      <KPICard
        title="Unique Visitors"
        value={data.visitors}
        formatter={(v) => formatMetric(v, 'number')}
        icon={<Users className="h-4 w-4" />}
        comparison={comparison?.visitors}
        target={targets?.visitors}
        formula="COUNT(DISTINCT user_id OR session_id)"
        dataSources={['analytics.events']}
        sparkline={sparklines?.visitors}
      />

      {/* Sessions */}
      <KPICard
        title="Sessions"
        value={data.sessions}
        formatter={(v) => formatMetric(v, 'number')}
        icon={<Activity className="h-4 w-4" />}
        comparison={comparison?.sessions}
        formula="COUNT(DISTINCT session_id)"
        dataSources={['analytics.events']}
        sparkline={sparklines?.sessions}
      />

      {/* Checkout Start Rate */}
      <KPICard
        title="Checkout Start Rate"
        value={data.checkout_start_rate}
        formatter={(v) => formatMetric(v, 'percent')}
        icon={<ShoppingCart className="h-4 w-4" />}
        comparison={comparison?.checkout_start_rate}
        target={targets?.checkout_start_rate}
        benchmark={{
          value: 15,  // Industry benchmark
          label: 'Industry Avg',
          type: 'industry'
        }}
        formula="(checkouts / visitors) * 100"
        dataSources={['analytics.events', 'ticketing.orders']}
        sparkline={sparklines?.checkout_start_rate}
      />

      {/* Purchase Rate */}
      <KPICard
        title="Purchase Rate"
        value={data.purchase_rate}
        formatter={(v) => formatMetric(v, 'percent')}
        icon={<DollarSign className="h-4 w-4" />}
        comparison={comparison?.purchase_rate}
        target={targets?.purchase_rate}
        benchmark={{
          value: 5,  // Industry benchmark
          label: 'Industry Avg',
          type: 'industry'
        }}
        formula="(purchases / visitors) * 100"
        dataSources={['ticketing.orders']}
        sparkline={sparklines?.purchase_rate}
      />

      {/* New vs Returning */}
      <KPICard
        title="New Buyers"
        value={data.new_buyers}
        formatter={(v) => formatMetric(v, 'number')}
        icon={<Users className="h-4 w-4" />}
        comparison={comparison?.new_buyers}
        formula="First purchase in period"
        dataSources={['audience_customers']}
      />

      <KPICard
        title="Returning Buyers"
        value={data.returning_buyers}
        formatter={(v) => formatMetric(v, 'number')}
        icon={<Users className="h-4 w-4" />}
        comparison={comparison?.returning_buyers}
        formula="Repeat purchases in period"
        dataSources={['audience_customers']}
      />

      {/* Mobile Conversion */}
      <KPICard
        title="Mobile Conversion"
        value={data.mobile_conversion_rate}
        formatter={(v) => formatMetric(v, 'percent')}
        icon={<Smartphone className="h-4 w-4" />}
        comparison={comparison?.mobile_conversion_rate}
        benchmark={{
          value: 3.5,
          label: 'Mobile Avg',
          type: 'industry'
        }}
        formula="Mobile purchases / mobile sessions"
        dataSources={['analytics.events', 'ticketing.orders']}
      />

      {/* Desktop Conversion */}
      <KPICard
        title="Desktop Conversion"
        value={data.desktop_conversion_rate}
        formatter={(v) => formatMetric(v, 'percent')}
        icon={<Monitor className="h-4 w-4" />}
        comparison={comparison?.desktop_conversion_rate}
        benchmark={{
          value: 8,
          label: 'Desktop Avg',
          type: 'industry'
        }}
        formula="Desktop purchases / desktop sessions"
        dataSources={['analytics.events', 'ticketing.orders']}
      />
    </div>
  );
}

