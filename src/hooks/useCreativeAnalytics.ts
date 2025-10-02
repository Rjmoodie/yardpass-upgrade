import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CreativeAnalyticsPoint = {
  creative_id: string;
  date: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_cents: number;
  credits_spent: number;
};

export type CreativeAnalyticsTotals = {
  impressions: number;
  clicks: number;
  ctr: number; // 0..1
  conversions: number;
  credits_spent: number;
};

export function useCreativeAnalytics({
  orgId,
  from,
  to,
  campaignIds,
  creativeIds,
}: {
  orgId?: string;
  from: Date | string;
  to: Date | string;
  campaignIds?: string[];
  creativeIds?: string[];
}) {
  const fromISO = typeof from === "string" ? from : from.toISOString();
  const toISO = typeof to === "string" ? to : to.toISOString();

  const q = useQuery({
    queryKey: [
      "creative-analytics",
      orgId,
      fromISO,
      toISO,
      campaignIds?.join(",") ?? "",
      creativeIds?.join(",") ?? "",
    ],
    queryFn: async (): Promise<CreativeAnalyticsPoint[]> => {
      if (!orgId) return [];

      // Use the secure RPC that enforces org membership
      const { data, error } = await supabase.rpc("rpc_creative_analytics_daily", {
        p_org_id: orgId,
        p_from: fromISO.slice(0, 10), // "YYYY-MM-DD"
        p_to: toISO.slice(0, 10),
        p_campaign_ids: campaignIds?.length ? campaignIds : null,
        p_creative_ids: creativeIds?.length ? creativeIds : null,
      });

      if (error) throw error;

      return (data ?? []).map((row) => ({
        creative_id: row.creative_id,
        date: row.date as string,
        impressions: row.impressions ?? 0,
        clicks: row.clicks ?? 0,
        conversions: row.conversions ?? 0,
        revenue_cents: row.revenue_cents ?? 0,
        credits_spent: row.credits_spent ?? 0,
      }));
    },
    enabled: !!orgId && !!fromISO && !!toISO,
  });

  const totals: CreativeAnalyticsTotals = useMemo(() => {
    const pts = q.data ?? [];
    const impressions = pts.reduce((s, p) => s + p.impressions, 0);
    const clicks = pts.reduce((s, p) => s + p.clicks, 0);
    const conversions = pts.reduce((s, p) => s + p.conversions, 0);
    const credits_spent = pts.reduce((s, p) => s + p.credits_spent, 0);
    const ctr = impressions ? clicks / impressions : 0;
    return { impressions, clicks, ctr, conversions, credits_spent };
  }, [q.data]);

  // Per-creative lifetime stats (for displaying in a table)
  const perCreative = useMemo(() => {
    const byCreative = new Map<
      string,
      {
        creative_id: string;
        impressions: number;
        clicks: number;
        conversions: number;
        credits_spent: number;
        ctr: number;
      }
    >();

    for (const row of q.data ?? []) {
      const prev = byCreative.get(row.creative_id) ?? {
        creative_id: row.creative_id,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        credits_spent: 0,
        ctr: 0,
      };

      byCreative.set(row.creative_id, {
        creative_id: row.creative_id,
        impressions: prev.impressions + row.impressions,
        clicks: prev.clicks + row.clicks,
        conversions: prev.conversions + row.conversions,
        credits_spent: prev.credits_spent + row.credits_spent,
        ctr: 0, // will compute after summing
      });
    }

    // Compute CTR for each creative
    return Array.from(byCreative.values()).map((c) => ({
      ...c,
      ctr: c.impressions ? c.clicks / c.impressions : 0,
    }));
  }, [q.data]);

  return {
    isLoading: q.isLoading,
    error: q.error as any,
    series: q.data ?? [],
    totals,
    perCreative, // For displaying creative performance table
  };
}
