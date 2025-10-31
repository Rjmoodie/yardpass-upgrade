// Analytics V2 - Attribution Pie Chart Component

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { AttributionRow } from '../api/types';

interface AttributionPieProps {
  attribution: AttributionRow[];
}

const COLORS = {
  click: '#3b82f6',
  viewThrough: '#10b981',
};

export function AttributionPie({ attribution }: AttributionPieProps) {
  // Aggregate totals
  const totals = attribution.reduce(
    (acc, row) => ({
      click: acc.click + row.click_conversions,
      vt: acc.vt + row.vt_conversions,
    }),
    { click: 0, vt: 0 }
  );

  const chartData = [
    { name: 'Last-Click (7d)', value: totals.click, color: COLORS.click },
    { name: 'View-Through (1d)', value: totals.vt, color: COLORS.viewThrough },
  ].filter((item) => item.value > 0); // Only show non-zero slices

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
        <div className="text-sm text-gray-500 font-medium mb-2">Attribution Mix</div>
        <div className="text-gray-400 text-sm">No attribution data available</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
      <div className="text-sm text-gray-500 font-medium mb-3">Attribution Mix</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#999' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}




