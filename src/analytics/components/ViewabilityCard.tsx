// Analytics V2 - Viewability Quality Component

import React from 'react';
import type { ViewabilityRow } from '../api/types';

interface ViewabilityCardProps {
  viewability: ViewabilityRow | null;
}

export function ViewabilityCard({ viewability }: ViewabilityCardProps) {
  if (!viewability) {
    return (
      <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
        <div className="text-sm text-gray-500 font-medium mb-2">Viewability (30d)</div>
        <div className="text-gray-400 text-sm">No data available</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
      <div className="text-sm text-gray-500 font-medium mb-3">Viewability (30d)</div>
      <div className="grid grid-cols-3 gap-3">
        <StatItem
          label="Avg % Visible"
          value={`${viewability.avg_pct_visible?.toFixed(1)}%`}
        />
        <StatItem
          label="Avg Dwell"
          value={`${Math.round(viewability.avg_dwell_ms)} ms`}
        />
        <StatItem
          label="Viewability Rate"
          value={`${(viewability.viewability_rate * 100).toFixed(1)}%`}
        />
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}


