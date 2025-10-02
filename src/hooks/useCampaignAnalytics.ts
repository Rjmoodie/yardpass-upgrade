import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AnalyticsPoint, AnalyticsTotals } from "@/types/campaigns";

export function useCampaignAnalytics({
  orgId,
  from,
  to,
  campaignIds,
}: {
  orgId?: string;
  from: Date | string;
  to: Date | string;
  campaignIds?: string[];
}) {
  const fromISO = typeof from === "string" ? from : from.toISOString();
  const toISO = typeof to === "string" ? to : to.toISOString();

  const q = useQuery({
    queryKey: ["campaign-analytics", orgId, fromISO, toISO, campaignIds?.join(",") ?? ""],
    queryFn: async (): Promise<AnalyticsPoint[]> => {
      if (!orgId) return [];
      
      // Query the MV and filter by org + date range
      let req = supabase
        .from("campaign_analytics_daily")
        .select("campaign_id, org_id, date, impressions, clicks, conversions, revenue_cents, credits_spent")
        .eq("org_id", orgId)
        .gte("date", fromISO.slice(0, 10))
        .lte("date", toISO.slice(0, 10))
        .order("date", { ascending: true });

      if (campaignIds?.length) {
        req = req.in("campaign_id", campaignIds);
      }

      const { data, error } = await req;
      if (error) throw error;

      // Aggregate per day across selected campaigns
      const byDate = new Map<string, AnalyticsPoint>();
      for (const row of data ?? []) {
        const d = row.date as string;
        const prev = byDate.get(d) ?? {
          date: d,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue_cents: 0,
          credits_spent: 0,
        };
        byDate.set(d, {
          date: d,
          impressions: prev.impressions + (row.impressions ?? 0),
          clicks: prev.clicks + (row.clicks ?? 0),
          conversions: prev.conversions + (row.conversions ?? 0),
          revenue_cents: prev.revenue_cents + (row.revenue_cents ?? 0),
          credits_spent: prev.credits_spent + (row.credits_spent ?? 0),
        });
      }

      return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!orgId && !!fromISO && !!toISO,
  });

  const totals: AnalyticsTotals = useMemo(() => {
    const pts = q.data ?? [];
    const impressions = pts.reduce((s, p) => s + p.impressions, 0);
    const clicks = pts.reduce((s, p) => s + p.clicks, 0);
    const credits_spent = pts.reduce((s, p) => s + p.credits_spent, 0);
    const ctr = impressions ? clicks / impressions : 0;
    return { impressions, clicks, ctr, credits_spent };
  }, [q.data]);

  return {
    isLoading: q.isLoading,
    error: q.error as any,
    series: q.data ?? [],
    totals,
  };
}
