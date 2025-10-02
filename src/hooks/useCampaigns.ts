import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CampaignRow, CampaignStatus, PacingStrategy, CampaignObjective } from "@/types/campaigns";

export function useCampaigns(orgId?: string) {
  const qc = useQueryClient();

  const campaignsQ = useQuery({
    queryKey: ["campaigns", orgId],
    queryFn: async (): Promise<CampaignRow[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
      const { data, error } = await supabase.from("campaigns").insert([insert]).select("*").single();
      if (error) throw error;
      return data as CampaignRow;
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
      const prev = qc.getQueryData<CampaignRow[]>(["campaigns", orgId]) ?? [];
      qc.setQueryData<CampaignRow[]>(["campaigns", orgId], (old) =>
        (old ?? []).map((c) => (c.id === id ? { ...c, status } : c))
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
    campaigns: campaignsQ.data ?? [],
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
