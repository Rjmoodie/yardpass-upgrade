import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays, format } from 'date-fns';

export const useCampaignAnalytics = (
  orgId?: string,
  dateRange = { from: addDays(new Date(), -13), to: new Date() }
) => {
  return useQuery({
    queryKey: ['campaign-analytics', orgId, dateRange],
    queryFn: async () => {
      if (!orgId) {
        return {
          totals: { impressions: 0, clicks: 0, ctr: 0, credits_spent: 0 },
          series: [],
        };
      }

      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      const SUPABASE_URL = 'https://yieslxnrfeqchbcmgavz.supabase.co';
      const url = new URL(`${SUPABASE_URL}/functions/v1/campaigns-analytics`);
      url.searchParams.append('org_id', orgId);
      url.searchParams.append('from', fromDate);
      url.searchParams.append('to', toDate);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();

      return {
        totals: {
          impressions: data.totals.impressions,
          clicks: data.totals.clicks,
          ctr: data.totals.ctr,
          credits_spent: data.totals.credits_spent,
          trend: { impressions: 0, clicks: 0, ctr: 0 }, // TODO: calculate trends
        },
        series: data.series,
      };
    },
    enabled: !!orgId,
  });
};
