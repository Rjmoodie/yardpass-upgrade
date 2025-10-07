import React from 'react';

interface CampaignChartProps {
  series: Array<{
    x: string;
    impressions: number;
    clicks: number;
  }>;
}

export default function CampaignChart({ series }: CampaignChartProps) {
  if (!series.length) {
    return (
      <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 mx-auto text-muted-foreground">📊</div>
          <p className="text-muted-foreground">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 900 300" role="img" aria-label="Campaign performance chart">
        <g opacity={0.15}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line key={t} x1={32} x2={868} y1={32 + (300 - 64) * t} y2={32 + (300 - 64) * t} stroke="currentColor" />
          ))}
        </g>
        {/* Simple chart implementation */}
        <text x="32" y="20" fontSize="12" className="text-muted-foreground">Campaign Performance</text>
        <text x="32" y="280" fontSize="12" className="text-muted-foreground">
          {series.length} data points
        </text>
      </svg>
    </div>
  );
}
