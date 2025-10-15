import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CampaignBoostRow = {
  campaign_id: string;
  creative_id: string | null;
  org_id: string | null;
  event_id: string;
  post_id: string | null;
  objective: string;
  pacing_strategy: string;
  headline: string | null;
  body_text: string | null;
  cta_label: string | null;
  cta_url: string | null;
  media_type: string;
  media_url: string | null;
  poster_url: string | null;
  event_title: string | null;
  event_description: string | null;
  event_cover_image: string | null;
  event_starts_at: string | null;
  event_location: string | null;
  event_city: string | null;
  event_category: string | null;
  organizer_name: string | null;
  organizer_id: string | null;
  owner_context_type: string | null;
  priority: number | null;
  frequency_cap_per_user: number | null;
  frequency_cap_period: 'session' | 'day' | 'week' | null;
  targeting: Record<string, unknown> | null;
  default_rate_model: 'cpm' | 'cpc' | string | null;
  cpm_rate_credits: number | null;
  cpc_rate_credits: number | null;
  remaining_credits: number | null;
  daily_remaining: number | null;
};

export function useCampaignBoosts({
  placement,
  limit = 6,
  enabled = true,
  userId,
}: {
  placement: 'feed' | 'search_results';
  limit?: number;
  enabled?: boolean;
  userId?: string | null;
}) {
  return useQuery({
    queryKey: ['campaign-boosts', placement, limit, userId ?? 'anon'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<CampaignBoostRow[]> => {
      try {
        const { data, error } = await supabase.rpc('get_active_campaign_creatives', {
          p_placement: placement,
          p_limit: limit,
          p_user_id: userId ?? null,
          p_now: new Date().toISOString(),
        });
        if (error) {
          console.warn('[useCampaignBoosts] rpc failed, returning empty array', error.message);
          return [];
        }
        return (data ?? []) as CampaignBoostRow[];
      } catch (err) {
        console.warn('[useCampaignBoosts] rpc not available, returning empty array', err);
        return [];
      }
    },
  });
}
