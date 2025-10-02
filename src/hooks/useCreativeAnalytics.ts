import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CreativeSeriesPoint = {
  creative_id: string;
  campaign_id: string;
  org_id: string;
  date: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_cents: number;
  credits_spent: number;
};

export type CreativeTotals = {
  creative_id: string;
  campaign_id: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_cents: number;
  credits_spent: number;
  ctr: number; // 0..1
};

export function useCreativeAnalytics({
  orgId,
  from,
  to,
  campaignIds,
  creativeIds,
}: {
  orgId: string;
  from: Date | string;
  to: Date | string;
  campaignIds?: string[] | null;
  creativeIds?: string[] | null;
}) {
  const fromStr = typeof from === "string" ? from.slice(0, 10) : toDateStr(from);
  const toStr = typeof to === "string" ? to.slice(0, 10) : toDateStr(to);

  const q = useQuery({
    queryKey: [
      "creative-analytics",
      orgId,
      fromStr,
      toStr,
      campaignIds?.join(",") ?? "",
      creativeIds?.join(",") ?? "",
    ],
    queryFn: async (): Promise<CreativeSeriesPoint[]> => {
      const { data, error } = await supabase.rpc("rpc_creative_analytics_daily", {
        p_org_id: orgId,
        p_from: fromStr,
        p_to: toStr,
        p_campaign_ids: campaignIds && campaignIds.length ? campaignIds : null,
        p_creative_ids: creativeIds && creativeIds.length ? creativeIds : null,
      });
      if (error) throw error;
      return (data ?? []) as CreativeSeriesPoint[];
    },
    enabled: !!orgId && !!fromStr && !!toStr,
  });

  // Totals per creative (over selected date range)
  const totalsByCreative: CreativeTotals[] = useMemo(() => {
    const map = new Map<string, CreativeTotals>();
    for (const r of q.data ?? []) {
      const key = r.creative_id;
      const prev = map.get(key) ?? {
        creative_id: r.creative_id,
        campaign_id: r.campaign_id,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue_cents: 0,
        credits_spent: 0,
        ctr: 0,
      };
      prev.impressions += r.impressions ?? 0;
      prev.clicks += r.clicks ?? 0;
      prev.conversions += r.conversions ?? 0;
      prev.revenue_cents += r.revenue_cents ?? 0;
      prev.credits_spent += r.credits_spent ?? 0;
      map.set(key, prev);
    }
    // compute CTR
    map.forEach((v) => {
      v.ctr = v.impressions ? v.clicks / v.impressions : 0;
    });
    return Array.from(map.values());
  }, [q.data]);

  return {
    isLoading: q.isLoading,
    error: q.error as any,
    series: q.data ?? [],
    totalsByCreative,
  };
}

function toDateStr(d: Date) {
  const z = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return z.toISOString().slice(0, 10); // YYYY-MM-DD
}
