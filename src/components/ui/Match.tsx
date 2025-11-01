// Sponsorship Match UI Components - Shared utilities for displaying match scores
import React from "react";
import { cn } from "@/lib/utils";

export interface MatchScoreProps {
  score: number | null | undefined;
  className?: string;
}

export function MatchScore({ score, className }: MatchScoreProps) {
  const pct = Number.isFinite(score as number) ? Math.round((score as number) * 100) : 0;
  const color = pct >= 70 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-gray-600";
  
  return (
    <div className={cn("text-sm font-medium", color, className)}>
      {pct}% Match
    </div>
  );
}

export interface MetricBadgeProps {
  label: string;
  value: number | null | undefined;
  className?: string;
}

export function MetricBadge({ label, value, className }: MetricBadgeProps) {
  const pct = Number.isFinite(value as number) ? Math.round((value as number) * 100) : 0;
  
  return (
    <div className={cn("text-center", className)}>
      <div className="text-2xl font-bold text-brand-600">{pct}%</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}

// Currency formatting helper
export const fmtCurrency = (cents: number | null | undefined) =>
  new Intl.NumberFormat(undefined, { 
    style: "currency", 
    currency: "USD", 
    maximumFractionDigits: 0 
  }).format(Math.max(0, Math.round((cents || 0) / 100)));

// Integer formatting helper
export const fmtInt = (n: number | null | undefined) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    Number.isFinite(n as number) ? (n as number) : 0
  );

// Date formatting helper
export const fmtDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

