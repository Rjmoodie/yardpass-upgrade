import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type Campaign = {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived';
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  startDate: string;
  endDate?: string;
};

export const useCampaigns = (orgId?: string) => {
  return useQuery({
    queryKey: ['campaigns', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      
      const SUPABASE_URL = 'https://yieslxnrfeqchbcmgavz.supabase.co';
      const url = new URL(`${SUPABASE_URL}/functions/v1/campaigns-list`);
      url.searchParams.append('org_id', orgId);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch campaigns');
      const data = await response.json();
      
      // Transform to match CampaignList props
      const campaigns: Campaign[] = (data.campaigns || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        budget: c.total_budget_credits || 0,
        spent: c.spent_credits || 0,
        impressions: 0, // TODO: aggregate from ad_impressions
        clicks: 0, // TODO: aggregate from ad_clicks
        startDate: new Date(c.start_date).toLocaleDateString(),
        endDate: c.end_date ? new Date(c.end_date).toLocaleDateString() : undefined,
      }));

      return campaigns;
    },
    enabled: !!orgId,
  });
};

export const useCreateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase.functions.invoke('campaigns-create', {
        body: payload,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
};
