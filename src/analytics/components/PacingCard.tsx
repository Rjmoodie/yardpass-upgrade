// Analytics V2 - Budget Pacing Component

import React from 'react';

interface PacingCardProps {
  budgetCredits: number;
  spentCredits: number;
  start: string; // yyyy-mm-dd
  end: string;   // yyyy-mm-dd
}

export function PacingCard({ budgetCredits, spentCredits, start, end }: PacingCardProps) {
  const pct = Math.min(100, Math.round((spentCredits / Math.max(1, budgetCredits)) * 100));
  const remaining = Math.max(0, budgetCredits - spentCredits);

  // Format numbers
  const formatNumber = (n: number) => new Intl.NumberFormat().format(Math.round(n));

  // Determine progress bar color
  const getProgressColor = () => {
    if (pct >= 100) return 'bg-red-500';
    if (pct >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="rounded-2xl p-4 shadow-sm bg-white border border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm text-gray-500 font-medium">Budget Pacing</div>
          <div className="text-lg font-semibold mt-1">
            {formatNumber(spentCredits)} / {formatNumber(budgetCredits)} credits
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {start} → {end}
          </div>
          {remaining > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {formatNumber(remaining)} credits remaining
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 text-right mt-1">{pct}%</div>
    </div>
  );
}




