import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CampaignOverview,
  CampaignRow,
  CampaignStatus,
  PacingStrategy,
  CampaignObjective,
} from "@/types/campaigns";

export function useCampaigns(orgId?: string) {
  const qc = useQueryClient();

  const campaignsQ = useQuery({
    queryKey: ["campaigns", orgId],
    queryFn: async (): Promise<CampaignOverview[]> => {
      if (!orgId) return [];
      try {
        const { data, error } = await supabase
          .from("campaigns_overview")
          .select("*")
          .eq("org_id", orgId)
          .order("last_activity_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });
        if (error) {
          console.error("[useCampaigns] Error fetching campaigns:", error);
          throw error;
        }
        return (data ?? []).map((row) => ({
          ...row,
          credits_last_7d: row.credits_last_7d ?? 0,
          credits_last_30d: row.credits_last_30d ?? row.credits_last_7d ?? 0,
          impressions_last_7d: row.impressions_last_7d ?? 0,
          clicks_last_7d: row.clicks_last_7d ?? 0,
          delivery_status: (row.delivery_status ?? row.status) as CampaignOverview["delivery_status"],
          pacing_health: (row.pacing_health ?? "on-track") as CampaignOverview["pacing_health"],
        }));
      } catch (err) {
        console.error("[useCampaigns] Unexpected error:", err);
        throw err;
      }
    },
    enabled: !!orgId,
  });

  /** Create */
  const create = useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string | null;
      objective: CampaignObjective;
      pacing_strategy: PacingStrategy;
      total_budget_credits: number;
      daily_budget_credits?: number | null;
      start_date: string; // ISO
      end_date?: string | null;
      timezone?: string;
      creatives?: any[];
      targeting?: any;
      pricing_model?: string;
    }) => {
      if (!orgId) throw new Error("Organization ID required");
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const insert = {
        org_id: orgId,
        created_by: user.id,
        name: payload.name,
        description: payload.description ?? null,
        objective: payload.objective,
        pacing_strategy: payload.pacing_strategy,
        total_budget_credits: payload.total_budget_credits,
        daily_budget_credits: payload.daily_budget_credits ?? null,
        start_date: payload.start_date,
        end_date: payload.end_date ?? null,
        timezone: payload.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        status: "draft" as CampaignStatus,
      };
      
      // Create the campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert([insert])
        .select("*")
        .single();
      
      if (campaignError) throw campaignError;
      
      // Create creatives if provided
      if (payload.creatives && payload.creatives.length > 0) {
        const creativeInserts = payload.creatives.map((creative) => ({
          campaign_id: campaign.id,
          media_type: creative.media_type || creative.type,
          media_url: creative.media_url,
          poster_url: creative.poster_url || null,
          headline: creative.headline,
          body_text: creative.body_text || null,
          cta_label: creative.cta_label || 'Learn More',
          cta_url: creative.cta_url || null,
          post_id: creative.post_id || null,
          active: creative.active ?? true,
        }));
        
        const { error: creativesError } = await supabase
          .from("ad_creatives")
          .insert(creativeInserts);
        
        if (creativesError) {
          console.error("Error creating creatives:", creativesError);
          // Don't fail the whole operation, but log it
        }
      }
      
      // Update campaign status to active if it has a start date in the past/present
      const startDate = new Date(payload.start_date);
      if (startDate <= new Date()) {
        const { error: statusError } = await supabase
          .from("campaigns")
          .update({ status: "active" as CampaignStatus })
          .eq("id", campaign.id);
        
        if (statusError) console.error("Error activating campaign:", statusError);
      }
      
      return campaign as CampaignRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns", orgId] });
    },
  });

  /** Generic status setter with optimistic update */
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CampaignStatus }) => {
      const { data, error } = await supabase
        .from("campaigns")
        .update({ status })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as CampaignRow;
    },
    onMutate: async ({ id, status }) => {
      if (!orgId) return;
      await qc.cancelQueries({ queryKey: ["campaigns", orgId] });
      const prev = qc.getQueryData<CampaignOverview[]>(["campaigns", orgId]) ?? [];
      qc.setQueryData<CampaignOverview[]>(["campaigns", orgId], (old) =>
        (old ?? []).map((c) =>
          c.id === id
            ? {
                ...c,
                status,
                delivery_status:
                  status === "active"
                    ? (c.delivery_status === "no-creatives" ? "no-creatives" : "active")
                    : (status as CampaignOverview["delivery_status"]),
              }
            : c
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && orgId) qc.setQueryData(["campaigns", orgId], ctx.prev);
    },
    onSettled: () => {
      if (orgId) qc.invalidateQueries({ queryKey: ["campaigns", orgId] });
    },
  });

  const pause = (id: string) => setStatus.mutate({ id, status: "paused" });
  const resume = (id: string) => setStatus.mutate({ id, status: "active" });
  const archive = (id: string) => setStatus.mutate({ id, status: "archived" });

  return {
    campaigns: (campaignsQ.data ?? []) as CampaignOverview[],
    isLoading: campaignsQ.isLoading,
    error: campaignsQ.error as any,
    createCampaign: create.mutateAsync,
    isCreating: create.isPending,
    pause,
    resume,
    archive,
    isUpdatingStatus: setStatus.isPending,
  };
}
