/**
 * Enhanced KPI Card with benchmarks, comparisons, and drillthrough
 * Makes every metric actionable and explainable
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Info, 
  ExternalLink,
  Target,
  Users as UsersIcon
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface Comparison {
  value: number;
  delta: number;
  deltaPct: number;
  period: 'WoW' | 'DoD' | 'MoM' | 'YoY';
}

interface Benchmark {
  value: number;
  label: string;
  type: 'peer' | 'goal' | 'industry';
}

interface KPICardProps {
  title: string;
  value: number | string;
  formatter?: (val: number) => string;
  icon?: React.ReactNode;
  
  // Comparison data
  comparison?: Comparison;
  
  // Benchmark data
  benchmark?: Benchmark;
  target?: number;
  
  // Explainability
  formula?: string;
  lastUpdated?: Date;
  dataSources?: string[];
  
  // Drillthrough
  onDrillthrough?: () => void;
  drillThroughLabel?: string;
  
  // Sparkline data (last 14 days)
  sparkline?: number[];
  
  // Anomaly detection
  anomaly?: {
    severity: 'low' | 'medium' | 'high';
    message: string;
  };
  
  // Styling
  className?: string;
}

export function KPICard({
  title,
  value,
  formatter = (v) => v.toLocaleString(),
  icon,
  comparison,
  benchmark,
  target,
  formula,
  lastUpdated,
  dataSources,
  onDrillthrough,
  drillThroughLabel = 'View details',
  sparkline,
  anomaly,
  className
}: KPICardProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value as string) || 0;
  const displayValue = typeof value === 'number' ? formatter(value) : value;
  
  // Calculate vs target
  const targetDelta = target ? ((numericValue - target) / target * 100) : null;
  const targetMet = targetDelta !== null && targetDelta >= 0;
  
  // Calculate vs benchmark
  const benchmarkDelta = benchmark ? ((numericValue - benchmark.value) / benchmark.value * 100) : null;
  const aboveBenchmark = benchmarkDelta !== null && benchmarkDelta >= 0;

  return (
    <Card className={cn("relative", className)}>
      {/* Anomaly indicator */}
      {anomaly && (
        <div className={cn(
          "absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse",
          anomaly.severity === 'high' && "bg-red-500",
          anomaly.severity === 'medium' && "bg-yellow-500",
          anomaly.severity === 'low' && "bg-blue-500"
        )} />
      )}
      
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {title}
          
          {/* Explainability tooltip */}
          {(formula || dataSources) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2 text-xs">
                    {formula && (
                      <div>
                        <div className="font-semibold">Formula:</div>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {formula}
                        </code>
                      </div>
                    )}
                    {dataSources && (
                      <div>
                        <div className="font-semibold">Data sources:</div>
                        <div className="text-muted-foreground">
                          {dataSources.join(', ')}
                        </div>
                      </div>
                    )}
                    {lastUpdated && (
                      <div className="text-muted-foreground">
                        Updated: {lastUpdated.toLocaleString()}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardTitle>
        {icon}
      </CardHeader>
      
      <CardContent>
        {/* Main value with sparkline */}
        <div className="flex items-end justify-between gap-2">
          <div className="text-2xl font-bold">{displayValue}</div>
          {sparkline && sparkline.length > 0 && (
            <Sparkline data={sparkline} className="h-8 w-20 opacity-50" />
          )}
        </div>
        
        {/* Badges row */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {/* Period comparison */}
          {comparison && (
            <Badge 
              variant={comparison.delta >= 0 ? "default" : "secondary"}
              className={cn(
                "text-xs gap-1",
                comparison.delta >= 0 ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"
              )}
            >
              {comparison.delta >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {comparison.deltaPct >= 0 ? '+' : ''}{comparison.deltaPct.toFixed(1)}% {comparison.period}
            </Badge>
          )}
          
          {/* vs Target */}
          {target !== undefined && targetDelta !== null && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline"
                    className={cn(
                      "text-xs gap-1 cursor-help",
                      targetMet && "border-green-500 text-green-700",
                      !targetMet && "border-[#1171c0] text-[#1171c0]"
                    )}
                  >
                    <Target className="h-3 w-3" />
                    {targetMet ? 'Met' : 'Below'} Goal
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div>Target: {formatter(target)}</div>
                    <div className={targetMet ? "text-green-600" : "text-[#1171c0]"}>
                      {targetDelta >= 0 ? '+' : ''}{targetDelta.toFixed(1)}% vs goal
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {/* vs Benchmark */}
          {benchmark && benchmarkDelta !== null && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline"
                    className={cn(
                      "text-xs gap-1 cursor-help",
                      aboveBenchmark && "border-blue-500 text-blue-700",
                      !aboveBenchmark && "border-gray-500 text-gray-700"
                    )}
                  >
                    <UsersIcon className="h-3 w-3" />
                    {aboveBenchmark ? 'Above' : 'Below'} Avg
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div>{benchmark.label}: {formatter(benchmark.value)}</div>
                    <div className={aboveBenchmark ? "text-blue-600" : "text-gray-600"}>
                      {benchmarkDelta >= 0 ? '+' : ''}{benchmarkDelta.toFixed(1)}% vs {benchmark.type}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {/* Anomaly badge */}
          {anomaly && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="destructive"
                    className={cn(
                      "text-xs gap-1 cursor-help",
                      anomaly.severity === 'high' && "bg-red-500",
                      anomaly.severity === 'medium' && "bg-yellow-500",
                      anomaly.severity === 'low' && "bg-blue-500"
                    )}
                  >
                    ⚠️ Alert
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs max-w-xs">
                    {anomaly.message}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        {/* Drillthrough link */}
        {onDrillthrough && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 h-7 px-2 text-xs w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={onDrillthrough}
          >
            <ExternalLink className="h-3 w-3 mr-1.5" />
            {drillThroughLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Sparkline component for trend visualization
 */
interface SparklineProps {
  data: number[];
  className?: string;
}

export function Sparkline({ data, className }: SparklineProps) {
  if (!data || data.length === 0) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  // Normalize to 0-1 range
  const normalized = data.map(d => (d - min) / range);
  
  // Create SVG path
  const width = 100;
  const height = 100;
  const points = normalized.map((y, i) => {
    const x = (i / (data.length - 1)) * width;
    const yPos = height - (y * height);
    return `${x},${yPos}`;
  }).join(' ');
  
  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className={cn("stroke-current fill-none", className)}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

