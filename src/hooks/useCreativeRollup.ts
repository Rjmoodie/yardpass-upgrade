import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CreativeRollup } from "@/types/campaigns";

export function useCreativeRollup(opts: {
  orgId: string;
  from: string; // "YYYY-MM-DD"
  to: string;   // "YYYY-MM-DD"
  campaignIds?: string[] | null;
  creativeIds?: string[] | null;
  includeSeries?: boolean;
  sort?: "impressions" | "clicks" | "ctr" | "credits_spent" | "revenue_cents";
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}) {
  const {
    orgId,
    from,
    to,
    campaignIds = null,
    creativeIds = null,
    includeSeries = false,
    sort = "impressions",
    dir = "desc",
    limit = 100,
    offset = 0,
  } = opts;

  return useQuery({
    queryKey: [
      "creative-rollup",
      orgId,
      from,
      to,
      campaignIds?.join(","),
      creativeIds?.join(","),
      includeSeries,
      sort,
      dir,
      limit,
      offset,
    ],
    queryFn: async (): Promise<CreativeRollup[]> => {
      console.log("[useCreativeRollup] Fetching creatives for org:", orgId);
      const { data, error } = await supabase.rpc("rpc_creative_analytics_rollup", {
        p_org_id: orgId,
        p_from: from,
        p_to: to,
        p_campaign_ids: campaignIds && campaignIds.length ? campaignIds : null,
        p_creative_ids: creativeIds && creativeIds.length ? creativeIds : null,
        p_include_series: includeSeries,
        p_sort: sort,
        p_dir: dir,
        p_limit: limit,
        p_offset: offset,
      });
      console.log("[useCreativeRollup] RPC result:", { data, error });
      if (error) {
        console.error("[useCreativeRollup] Error fetching creatives:", error);
        throw error;
      }
      return data as CreativeRollup[];
    },
    enabled: !!orgId && !!from && !!to,
    staleTime: 60_000,
  });
}
