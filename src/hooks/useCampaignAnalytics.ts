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
    queryFn: async (): Promise<{ series: AnalyticsPoint[]; rawData: any[] }> => {
      if (!orgId) return { series: [], rawData: [] };
      
      // Use the secure RPC that enforces org membership
      const { data, error } = await supabase.rpc("rpc_campaign_analytics_daily", {
        p_org_id: orgId,
        p_from: fromISO.slice(0, 10), // "YYYY-MM-DD"
        p_to: toISO.slice(0, 10),
        p_campaign_ids: campaignIds?.length ? campaignIds : null,
      });

      if (error) throw error;

      // Aggregate per day across selected campaigns if multiple campaigns returned
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

      return {
        series: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
        rawData: data ?? [],
      };
    },
    enabled: !!orgId && !!fromISO && !!toISO,
  });

  const totals: AnalyticsTotals = useMemo(() => {
    const pts = q.data?.series ?? [];
    const impressions = pts.reduce((s, p) => s + p.impressions, 0);
    const clicks = pts.reduce((s, p) => s + p.clicks, 0);
    const credits_spent = pts.reduce((s, p) => s + p.credits_spent, 0);
    const ctr = impressions ? clicks / impressions : 0;
    return { impressions, clicks, ctr, credits_spent };
  }, [q.data]);

  // Aggregate by campaign
  const totalsByCampaign = useMemo(() => {
    const map = new Map<string, AnalyticsTotals & { campaign_id: string }>();
    for (const row of q.data?.rawData ?? []) {
      const key = row.campaign_id;
      const prev = map.get(key) ?? {
        campaign_id: key,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue_cents: 0,
        credits_spent: 0,
        ctr: 0,
      };
      prev.impressions += row.impressions ?? 0;
      prev.clicks += row.clicks ?? 0;
      prev.conversions += row.conversions ?? 0;
      prev.revenue_cents += row.revenue_cents ?? 0;
      prev.credits_spent += row.credits_spent ?? 0;
      map.set(key, prev);
    }
    // Compute CTR
    map.forEach((v) => {
      v.ctr = v.impressions ? v.clicks / v.impressions : 0;
    });
    return Array.from(map.values());
  }, [q.data]);

  return {
    isLoading: q.isLoading,
    error: q.error as any,
    series: q.data?.series ?? [],
    totals,
    totalsByCampaign,
  };
}
