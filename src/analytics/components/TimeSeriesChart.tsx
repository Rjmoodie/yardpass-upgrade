// Analytics V2 - Time Series Chart Component

import React from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { DailyRow } from '../api/types';

interface TimeSeriesChartProps {
  data: DailyRow[];
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  // Format data for chart (show friendly date)
  const chartData = data.map((row) => ({
    ...row,
    date: new Date(row.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
      <div className="text-sm text-gray-500 font-medium mb-3">Spend & Engagement</div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              stroke="#999"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              stroke="#999"
              label={{ value: 'Spend (credits)', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              stroke="#999"
              label={{ value: 'Engagement', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e5e5',
                borderRadius: '8px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="spend_credits"
              name="Spend (credits)"
              yAxisId="left"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            />
            <Line
              dataKey="impressions"
              name="Impressions"
              yAxisId="right"
              type="monotone"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              dataKey="clicks"
              name="Clicks"
              yAxisId="right"
              type="monotone"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              dataKey="conversions"
              name="Conversions"
              yAxisId="right"
              type="monotone"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


