// Mini sparkline chart for KPI cards
// Shows trend at a glance

import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineProps {
  data: any[];
  dataKey: string;
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ 
  data, 
  dataKey, 
  color = '#3b82f6',
  width = 80,
  height = 40
}: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-300 text-xs" style={{ width, height }}>
        No data
      </div>
    );
  }

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2} 
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}



