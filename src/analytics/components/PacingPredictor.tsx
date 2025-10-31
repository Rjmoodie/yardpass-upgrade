// Budget Pacing Predictor
// Shows spend progress and forecasts days remaining based on avg daily spend

import React from 'react';
import type { DailyRow } from '../api/types';

interface PacingPredictorProps {
  totalBudget: number;
  currentSpend: number;
  dailyData: DailyRow[];
  campaignStartDate?: string;
  campaignEndDate?: string;
}

export function PacingPredictor({ 
  totalBudget, 
  currentSpend, 
  dailyData,
  campaignStartDate,
  campaignEndDate 
}: PacingPredictorProps) {
  const remaining = Math.max(totalBudget - currentSpend, 0);
  const progressPct = totalBudget > 0 ? (currentSpend / totalBudget) * 100 : 0;

  // Calculate avg daily spend from last 7 days (or all available data)
  const recentDays = dailyData.slice(-7);
  const avgDailySpend = recentDays.length > 0
    ? recentDays.reduce((sum, d) => sum + (d.spend_credits || 0), 0) / recentDays.length
    : 0;

  const daysRemaining = avgDailySpend > 0 
    ? remaining / avgDailySpend 
    : Infinity;

  // Format dates
  const formatDate = (date?: string) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
      <div className="text-sm text-gray-500 font-medium mb-2">Budget Pacing</div>
      
      {/* Current spend */}
      <div className="text-2xl font-semibold">
        {currentSpend.toFixed(2)} / {totalBudget.toLocaleString()} credits
      </div>
      
      {/* Campaign dates */}
      {(campaignStartDate || campaignEndDate) && (
        <div className="text-xs text-gray-500 mt-1">
          {formatDate(campaignStartDate)} — {formatDate(campaignEndDate)}
        </div>
      )}
      
      {/* Remaining budget */}
      <div className="text-xs text-gray-600 mt-1">
        {remaining.toLocaleString()} credits remaining
      </div>
      
      {/* Progress bar */}
      <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${
            progressPct >= 90 ? 'bg-red-500' : 
            progressPct >= 70 ? 'bg-yellow-500' : 
            'bg-blue-500'
          }`}
          style={{ width: `${Math.min(progressPct, 100)}%` }}
        />
      </div>
      
      {/* Pacing indicator */}
      <div className="text-xs text-gray-500 mt-2">
        {progressPct.toFixed(2)}% of budget used
      </div>
      
      {/* Forecast */}
      {avgDailySpend > 0 && Number.isFinite(daysRemaining) && remaining > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-600 flex items-center gap-1">
            <span className="font-medium">📊 Est. {daysRemaining.toFixed(1)} days remaining</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Based on ${avgDailySpend.toFixed(2)}/day average
          </div>
        </div>
      )}
      
      {avgDailySpend === 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            No recent spend to forecast
          </div>
        </div>
      )}
      
      {remaining === 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="text-xs text-red-600 font-medium">
            ⚠️ Budget depleted
          </div>
        </div>
      )}
    </div>
  );
}



