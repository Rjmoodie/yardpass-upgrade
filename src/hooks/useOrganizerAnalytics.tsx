import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface EventAnalytics {
  event_id: string;
  event_title: string;
  total_revenue: number;
  total_attendees: number;
  ticket_sales: number;
  total_views: number;
  engagement_metrics: {
    likes: number;
    comments: number;
    shares: number;
  };
  check_ins: number;
  refunds: {
    count: number;
    amount: number;
  };
}

interface OverallAnalytics {
  total_events: number;
  total_revenue: number;
  total_attendees: number;
  completed_events: number;
}

export function useOrganizerAnalytics() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalytics[]>([]);
  const [overallAnalytics, setOverallAnalytics] = useState<OverallAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    fetchAnalytics();
  }, [user, profile]);

  const fetchAnalytics = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      console.log('Fetching analytics for user:', user.id);

      // Fetch overall analytics based on user's context
      const { data: overallData, error: overallError } = await supabase
        .rpc('get_user_analytics', { p_user_id: user.id });

      if (overallError) {
        console.error('Overall analytics error:', overallError);
        throw overallError;
      }

      console.log('Overall analytics data:', overallData);

      if (overallData && overallData.length > 0) {
        setOverallAnalytics(overallData[0]);
      } else {
        // Set default analytics when no data exists
        setOverallAnalytics({
          total_events: 0,
          total_revenue: 0,
          total_attendees: 0,
          completed_events: 0
        });
      }

      // 1) Org memberships (collect org ids)
      const { data: orgMemberships, error: orgErr } = await supabase
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', user.id);

      if (orgErr) {
        console.error('Org memberships error:', orgErr);
      }
      const orgIds = (orgMemberships?.map(m => m.org_id) ?? []).filter(Boolean);

      // Helper to build ownership filter safely
      const ownerFilters: string[] = [
        `and(owner_context_type.eq.individual,owner_context_id.eq.${user.id})`,
      ];
      if (orgIds.length) {
        ownerFilters.push(
          `and(owner_context_type.eq.organization,owner_context_id.in.(${orgIds.join(',')}))`
        );
      }
      const ownershipOr = ownerFilters.join(',');

      // 2) Quick existence probe
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, title, created_at, start_at, end_at, completed_at, owner_context_type, owner_context_id, created_by')
        .or(ownershipOr);

      console.log('Events query result:', { events, eventsError, userId: user.id, orgIds });

      if (eventsError) {
        console.error('Events query error:', eventsError);
        setEventAnalytics([]);
        return;
      }

      // 3) Detailed analytics with explicit FKs for ALL embeds
      const { data: detailedEvents, error: detailedError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          created_at,
          start_at,
          end_at,
          completed_at,

          orders:orders!orders_event_id_fkey (
            id,
            total_cents,
            status,
            order_items:order_items!order_items_order_id_fkey ( quantity )
          ),

          tickets:tickets!tickets_event_id_fkey (
            id,
            status,
            redeemed_at
          ),

          event_posts:event_posts!event_posts_event_id_fkey (
            id,
            event_reactions:event_reactions!event_reactions_post_id_fkey ( kind )
          ),

          scan_logs:scan_logs!scan_logs_event_id_fkey (
            id,
            result
          )
        `)
        .or(ownershipOr);

      console.log('Detailed events result:', { detailedEvents, detailedError });

      if (detailedError) {
        console.error('Detailed analytics error:', detailedError);
      }

      // 4) Process analytics with complex data
      const source = detailedEvents ?? events ?? [];
      const processedAnalytics: EventAnalytics[] = source.map((event: any) => {
        const paidOrders = (event.orders ?? []).filter((o: any) => o.status === 'paid');
        const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + (o.total_cents || 0), 0) / 100;

        const ticketSales = paidOrders.reduce(
          (sum: number, o: any) =>
            sum + (o.order_items?.reduce((acc: number, it: any) => acc + (it.quantity || 0), 0) || 0),
          0
        );

        const checkIns = (event.scan_logs ?? []).filter((log: any) => log.result === 'valid').length;

        const reactions = (event.event_posts ?? []).flatMap((p: any) => p.event_reactions ?? []);
        const likes = reactions.filter((r: any) => r.kind === 'like').length;
        const comments = reactions.filter((r: any) => r.kind === 'comment').length;
        const shares = reactions.filter((r: any) => r.kind === 'share').length;

        return {
          event_id: event.id,
          event_title: event.title,
          total_revenue: totalRevenue,
          total_attendees: event.tickets?.length || 0,
          ticket_sales: ticketSales,
          total_views: 0, // This would need to be tracked separately
          engagement_metrics: {
            likes,
            comments,
            shares
          },
          check_ins: checkIns,
          refunds: {
            count: 0, // Would need to join refunds table
            amount: 0
          }
        };
      });

      console.log('Processed analytics:', processedAnalytics);
      setEventAnalytics(processedAnalytics);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalytics = () => {
    console.log('Refreshing analytics...');
    fetchAnalytics();
  };

  return {
    eventAnalytics,
    overallAnalytics,
    loading,
    error,
    refreshAnalytics
  };
}