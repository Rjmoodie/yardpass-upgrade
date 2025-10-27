import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CreativeRow } from "@/types/campaigns";

export function useCreatives(orgId?: string) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["creatives", orgId],
    queryFn: async (): Promise<CreativeRow[]> => {
      if (!orgId) return [];
      
      // Join via campaigns to enforce org
      const { data, error } = await supabase
        .from("ad_creatives")
        .select("*, campaigns!inner(org_id)")
        .eq("campaigns.org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // Strip joined campaigns.* if returned
      return (data as any[]).map((r) => {
        const { campaigns, ...rest } = r;
        return rest as CreativeRow;
      });
    },
    enabled: !!orgId,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { data, error } = await supabase
        .from("ad_creatives")
        .update({ active: next })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as CreativeRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creatives", orgId] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreativeRow> }) => {
      const { data, error } = await supabase
        .from("ad_creatives")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as CreativeRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creatives", orgId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ad_creatives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creatives", orgId] }),
  });

  return {
    creatives: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error as any,
    toggleActive: toggleActive.mutateAsync,
    updateCreative: update.mutateAsync,
    deleteCreative: remove.mutateAsync,
  };
}
