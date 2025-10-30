// Analytics V2 - Top Metrics Bar Component

import React from 'react';
import type { MetricsTotals } from '../api/types';

interface MetricsBarProps {
  totals: MetricsTotals;
}

export function MetricsBar({ totals }: MetricsBarProps) {
  const { impressions, clicks, conversions, spend_credits, value_cents } = totals;

  // Calculate derived metrics with NaN protection
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend_credits / clicks : 0;
  const cpm = impressions > 0 ? (spend_credits / impressions) * 1000 : 0;
  const revenue = (value_cents || 0) / 100;
  const roas = spend_credits > 0 && revenue > 0 ? revenue / spend_credits : 0;

  // Formatters with NaN protection
  const formatNumber = (n: number) => {
    if (!isFinite(n)) return '0';
    return new Intl.NumberFormat().format(Math.round(n));
  };
  const formatMoney = (n: number) => {
    if (!isFinite(n)) return '$0.00';
    return `$${n.toFixed(2)}`;
  };
  const formatMetric = (n: number) => {
    if (!isFinite(n)) return '0.00';
    return n.toFixed(2);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <MetricCard
        label="Impressions"
        value={formatNumber(impressions)}
      />
      <MetricCard
        label="Clicks"
        value={formatNumber(clicks)}
        sub={`${formatMetric(ctr)}% CTR`}
      />
      <MetricCard
        label="Conversions"
        value={formatNumber(conversions)}
      />
      <MetricCard
        label="Spend"
        value={`${formatMetric(spend_credits)} credits`}
        sub={`eCPM ${formatMetric(cpm)} • CPC ${formatMetric(cpc)}`}
      />
      <MetricCard
        label="Revenue"
        value={formatMoney(revenue)}
        sub={`ROAS ${formatMetric(roas)}×`}
      />
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
}

function MetricCard({ label, value, sub }: MetricCardProps) {
  return (
    <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
      <div className="text-sm text-gray-500 font-medium">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

