// Enhanced KPI Card with period comparison
// Shows current value, previous value, and % change

import React from 'react';

interface KpiCardEnhancedProps {
  title: string;
  currentValue: number;
  previousValue: number;
  format?: (n: number) => string;
  suffix?: string;
}

export function KpiCardEnhanced({ 
  title, 
  currentValue, 
  previousValue, 
  format = (n) => n.toLocaleString(),
  suffix = ''
}: KpiCardEnhancedProps) {
  const changePct = previousValue > 0 
    ? ((currentValue - previousValue) / previousValue) * 100 
    : 0;
  
  const isPositive = changePct >= 0;
  const absChange = Math.abs(changePct);
  const hasChange = previousValue > 0 && Math.abs(changePct) > 0.01;

  return (
    <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
      <div className="text-sm text-gray-500 font-medium">{title}</div>
      <div className="text-2xl font-semibold mt-1">
        {format(currentValue)}{suffix && <span className="text-lg text-gray-500 ml-1">{suffix}</span>}
      </div>
      {hasChange && (
        <div className={`text-xs mt-1 font-medium flex items-center gap-1 ${
          isPositive ? 'text-green-600' : 'text-red-600'
        }`}>
          <span>{isPositive ? '▲' : '▼'}</span>
          <span>{absChange.toFixed(1)}%</span>
          <span className="text-gray-400 font-normal">vs prev period</span>
        </div>
      )}
      {!hasChange && previousValue === 0 && (
        <div className="text-xs mt-1 text-gray-400">
          No previous data
        </div>
      )}
    </div>
  );
}


