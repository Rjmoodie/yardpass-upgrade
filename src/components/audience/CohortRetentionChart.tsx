/**
 * Cohort Retention Chart
 * Heatmap showing weekly retention rates
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CohortRetention } from '@/hooks/useAudienceIntelligence';

interface CohortRetentionChartProps {
  data: CohortRetention[] | null;
  loading: boolean;
}

export function CohortRetentionChart({ data, loading }: CohortRetentionChartProps) {
  const chartData = useMemo(() => {
    if (!data) return { cohorts: [], maxWeeks: 0 };
    
    // Group by cohort
    const cohortMap = new Map<string, Map<number, CohortRetention>>();
    let maxWeeks = 0;
    
    data.forEach(row => {
      if (!cohortMap.has(row.cohort_week)) {
        cohortMap.set(row.cohort_week, new Map());
      }
      cohortMap.get(row.cohort_week)!.set(row.week_offset, row);
      maxWeeks = Math.max(maxWeeks, row.week_offset);
    });
    
    const cohorts = Array.from(cohortMap.entries())
      .map(([week, weeks]) => ({
        cohort_week: week,
        weeks: Array.from(weeks.values())
      }))
      .sort((a, b) => b.cohort_week.localeCompare(a.cohort_week))
      .slice(0, 12);  // Last 12 cohorts
    
    return { cohorts, maxWeeks };
  }, [data]);

  const getRetentionColor = (rate: number) => {
    if (rate >= 40) return 'bg-green-500';
    if (rate >= 25) return 'bg-blue-400';
    if (rate >= 10) return 'bg-[#1171c0]';
    return 'bg-blue-300';
  };

  const getRetentionOpacity = (rate: number) => {
    if (rate >= 60) return 'opacity-100';
    if (rate >= 40) return 'opacity-80';
    if (rate >= 20) return 'opacity-60';
    if (rate >= 10) return 'opacity-40';
    return 'opacity-20';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cohort Retention</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cohort Retention</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Not enough repeat purchase data yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cohort Retention</CardTitle>
        <CardDescription>
          Weekly repeat purchase rates by cohort
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Header row */}
            <div className="flex items-center gap-1 mb-2">
              <div className="w-24 text-xs font-medium text-muted-foreground">Cohort</div>
              <div className="w-16 text-xs font-medium text-muted-foreground text-center">W0</div>
              {[...Array(chartData.maxWeeks)].map((_, i) => (
                <div key={i} className="w-16 text-xs font-medium text-muted-foreground text-center">
                  W{i + 1}
                </div>
              ))}
            </div>
            
            {/* Cohort rows */}
            <div className="space-y-1">
              {chartData.cohorts.map(cohort => {
                const cohortDate = new Date(cohort.cohort_week);
                const cohortLabel = cohortDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                });
                
                return (
                  <div key={cohort.cohort_week} className="flex items-center gap-1">
                    <div className="w-24 text-xs font-medium">{cohortLabel}</div>
                    {[...Array(chartData.maxWeeks + 1)].map((_, weekOffset) => {
                      const weekData = cohort.weeks.find(w => w.week_offset === weekOffset);
                      const rate = weekData?.retention_rate || 0;
                      
                      return (
                        <div
                          key={weekOffset}
                          className={`
                            w-16 h-10 flex items-center justify-center rounded text-xs font-semibold
                            ${weekData ? getRetentionColor(rate) : 'bg-muted'}
                            ${weekData ? getRetentionOpacity(rate) : ''}
                            ${weekData ? 'text-white' : 'text-muted-foreground'}
                            hover:scale-105 transition-transform cursor-help
                          `}
                          title={weekData 
                            ? `${rate}% retained (${weekData.buyers} buyers)`
                            : 'No data'
                          }
                        >
                          {weekData ? `${rate}%` : '—'}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs">
          <span className="text-muted-foreground">Retention Rate:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span>≥40%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-blue-400 opacity-80" />
            <span>25-39%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-[#1171c0] opacity-60" />
            <span>10-24%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-blue-300 opacity-40" />
            <span><10%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

