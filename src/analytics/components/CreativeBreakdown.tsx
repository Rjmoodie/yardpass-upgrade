// Analytics V2 - Creative Breakdown Bar Chart Component

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { CreativeDailyRow } from '../api/types';

interface CreativeBreakdownProps {
  creatives: CreativeDailyRow[];
}

export function CreativeBreakdown({ creatives }: CreativeBreakdownProps) {
  // Aggregate by creative
  const byCreative = Object.values(
    creatives.reduce<Record<string, any>>((acc, row) => {
      const key = row.creative_id;
      if (!acc[key]) {
        acc[key] = {
          creative_id: key,
          creative_name: key.slice(0, 8) + '…', // Truncate for display
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend_credits: 0,
        };
      }
      acc[key].impressions += row.impressions || 0;
      acc[key].clicks += row.clicks || 0;
      acc[key].conversions += row.conversions || 0;
      acc[key].spend_credits += row.spend_credits || 0;
      return acc;
    }, {})
  );

  // Sort by spend (highest first)
  byCreative.sort((a, b) => b.spend_credits - a.spend_credits);

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-sm mb-2">{data.creative_id?.slice(0, 8)}...</p>
        <p className="text-sm text-blue-600">Spend: {(data.spend_credits || 0).toFixed(2)} credits</p>
        <p className="text-sm text-green-600">Clicks: {data.clicks || 0}</p>
        <p className="text-sm text-amber-600">Conversions: {data.conversions || 0}</p>
      </div>
    );
  };

  if (byCreative.length === 0) {
    return (
      <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
        <div className="text-sm text-gray-500 font-medium mb-2">Creative Performance</div>
        <div className="text-gray-400 text-sm">No creative data available</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
      <div className="text-sm text-gray-500 font-medium mb-3">Creative Performance (Totals)</div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byCreative}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="creative_name"
              tick={{ fontSize: 11 }}
              stroke="#999"
            />
            <YAxis tick={{ fontSize: 12 }} stroke="#999" />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="spend_credits" name="Spend" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="clicks" name="Clicks" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="conversions" name="Conversions" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Creative Performance Table */}
      <div className="mt-6 border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Creatives (Leaderboard)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 font-medium text-gray-600">Creative</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Impressions</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Clicks</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">CTR</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Conversions</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">CPC</th>
                <th className="text-right py-2 px-2 font-medium text-gray-600">Spend</th>
              </tr>
            </thead>
            <tbody>
              {byCreative.map((creative) => {
                const ctr = creative.impressions > 0 
                  ? ((creative.clicks / creative.impressions) * 100).toFixed(2) 
                  : '0.00';
                const cpc = creative.clicks > 0 
                  ? (creative.spend_credits / creative.clicks).toFixed(2) 
                  : '0.00';
                
                return (
                  <tr key={creative.creative_id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2 font-mono text-xs">{creative.creative_id?.slice(0, 8)}...</td>
                    <td className="py-2 px-2 text-right">{creative.impressions}</td>
                    <td className="py-2 px-2 text-right">{creative.clicks}</td>
                    <td className="py-2 px-2 text-right">{ctr}%</td>
                    <td className="py-2 px-2 text-right">{creative.conversions}</td>
                    <td className="py-2 px-2 text-right">{cpc}</td>
                    <td className="py-2 px-2 text-right font-medium">{creative.spend_credits.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


