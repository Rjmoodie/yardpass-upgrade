// Analytics V2 - Creative Performance Table Component

import React from 'react';
import type { CreativeDailyRow } from '../api/types';

interface CreativeTableProps {
  creatives: CreativeDailyRow[];
}

export function CreativeTable({ creatives }: CreativeTableProps) {
  // Aggregate by creative
  const aggregated = Object.values(
    creatives.reduce<Record<string, any>>((acc, row) => {
      const key = row.creative_id;
      if (!acc[key]) {
        acc[key] = {
          creative_id: key,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend_credits: 0,
        };
      }
      acc[key].impressions += row.impressions;
      acc[key].clicks += row.clicks;
      acc[key].conversions += row.conversions;
      acc[key].spend_credits += row.spend_credits;
      return acc;
    }, {})
  );

  // Sort by spend (highest first)
  aggregated.sort((a, b) => b.spend_credits - a.spend_credits);

  if (aggregated.length === 0) {
    return (
      <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
        <div className="text-sm text-gray-500 font-medium mb-2">Creatives (Leaderboard)</div>
        <div className="text-gray-400 text-sm">No creative data available</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
      <div className="text-sm text-gray-500 font-medium mb-3">Creatives (Leaderboard)</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="p-2 font-medium">Creative</th>
              <th className="p-2 font-medium text-right">Impressions</th>
              <th className="p-2 font-medium text-right">Clicks</th>
              <th className="p-2 font-medium text-right">CTR</th>
              <th className="p-2 font-medium text-right">Conversions</th>
              <th className="p-2 font-medium text-right">CPC</th>
              <th className="p-2 font-medium text-right">Spend</th>
            </tr>
          </thead>
          <tbody>
            {aggregated.map((row) => {
              const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
              const cpc = row.clicks > 0 ? (row.spend_credits || 0) / row.clicks : 0;
              const spend = row.spend_credits || 0;

              return (
                <tr key={row.creative_id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">
                    {row.creative_id.slice(0, 8)}…
                  </td>
                  <td className="p-2 text-right">{row.impressions.toLocaleString()}</td>
                  <td className="p-2 text-right">{row.clicks.toLocaleString()}</td>
                  <td className="p-2 text-right">{isFinite(ctr) ? ctr.toFixed(2) : '0.00'}%</td>
                  <td className="p-2 text-right">{row.conversions.toLocaleString()}</td>
                  <td className="p-2 text-right">{isFinite(cpc) ? cpc.toFixed(2) : '0.00'}</td>
                  <td className="p-2 text-right font-medium">{spend.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

