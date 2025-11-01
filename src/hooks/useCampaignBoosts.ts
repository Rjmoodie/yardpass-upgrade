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

type EligibleAdRow = {
  campaign_id: string;
  creative_id: string;
  event_id: string;
  org_id: string;
  org_name: string;
  org_logo_url: string | null;
  event_title: string;
  event_description: string | null;
  event_cover_image: string | null;
  event_start_at: string;
  event_venue: Record<string, any> | null;
  event_category: string;
  pricing_model: string;
  estimated_rate: number;
  priority_score: number;
  cta_label: string;
  cta_url: string | null;
};

export function useCampaignBoosts({
  placement,
  limit = 6,
  enabled = true,
  userId,
  category,
  location,
}: {
  placement: 'feed' | 'search_results';
  limit?: number;
  enabled?: boolean;
  userId?: string | null;
  category?: string | null;
  location?: string | null;
}) {
  return useQuery({
    queryKey: ['campaign-boosts', placement, limit, userId ?? 'anon', category, location],
    enabled: enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<CampaignBoostRow[]> => {
      try {
        const { data, error } = await supabase.rpc('get_eligible_ads', {
          p_placement: placement,
          p_limit: limit,
          p_user_id: userId ?? null,
          p_category: category ?? null,
          p_location: location ?? null,
          p_keywords: null,
        });

        if (error) {
          console.warn('[useCampaignBoosts] rpc failed, returning empty array', error.message);
          return [];
        }

        // Map the response from get_eligible_ads to CampaignBoostRow format
        const mappedData: CampaignBoostRow[] = (data as EligibleAdRow[] ?? []).map((ad) => ({
          campaign_id: ad.campaign_id,
          creative_id: ad.creative_id,
          org_id: ad.org_id,
          event_id: ad.event_id,
          post_id: null,
          objective: 'awareness',
          pacing_strategy: 'standard',
          headline: ad.event_title,
          body_text: ad.event_description,
          cta_label: ad.cta_label,
          cta_url: ad.cta_url,
          media_type: 'image',
          media_url: ad.event_cover_image,
          poster_url: ad.org_logo_url,
          event_title: ad.event_title,
          event_description: ad.event_description,
          event_cover_image: ad.event_cover_image,
          event_starts_at: ad.event_start_at,
          event_location: ad.event_venue?.name ?? null,
          event_city: null,
          event_category: ad.event_category,
          organizer_name: ad.org_name,
          organizer_id: ad.org_id,
          owner_context_type: 'organization',
          priority: ad.priority_score,
          frequency_cap_per_user: null,
          frequency_cap_period: null,
          targeting: null,
          default_rate_model: ad.pricing_model as 'cpm' | 'cpc',
          cpm_rate_credits: ad.pricing_model === 'cpm' ? ad.estimated_rate : null,
          cpc_rate_credits: ad.pricing_model === 'cpc' ? ad.estimated_rate : null,
          remaining_credits: null,
          daily_remaining: null,
        }));

        console.log(`[useCampaignBoosts] Successfully fetched ${mappedData.length} ads for placement: ${placement}`);
        return mappedData;
      } catch (err) {
        console.warn('[useCampaignBoosts] rpc error, returning empty array', err);
        return [];
      }
    },
  });
}
