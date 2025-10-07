import { lazy, Suspense, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { BarChart3, Calendar as CalendarIcon, Eye, MousePointerClick, TrendingUp, DollarSign } from "lucide-react";
import { addDays, format } from "date-fns";
import { useQuery } from '@tanstack/react-query';
import { getCampaignMetrics } from '@/lib/api/campaigns';
import LoadingSpinner from '@/components/dashboard/LoadingSpinner';

// Lazy load chart component
const CampaignChart = lazy(() => import('./charts/CampaignChart'));

export default function CampaignAnalytics({ campaignId }: { campaignId: string }) {
  const { data } = useQuery({
    queryKey: ['campaign-metrics', campaignId],
    queryFn: () => getCampaignMetrics(campaignId),
    staleTime: 5 * 60_000,
  });
  
  const series = useMemo(() => {
    if (!data) return [];
    return data.points.map(p => ({ x: p.date, impressions: p.impressions, clicks: p.clicks }));
  }, [data]);
  
  return (
    <Suspense fallback={<div className="p-4"><LoadingSpinner /></div>}>
      <CampaignChart series={series} />
    </Suspense>
  );
}