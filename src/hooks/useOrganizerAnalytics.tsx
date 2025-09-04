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

      // Fetch overall analytics based on user's context
      const { data: overallData, error: overallError } = await supabase
        .rpc('get_user_analytics', { p_user_id: user.id });

      if (overallError) throw overallError;

      if (overallData && overallData.length > 0) {
        setOverallAnalytics(overallData[0]);
      }

      // Fetch detailed event analytics
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          created_at,
          start_at,
          end_at,
          completed_at,
          orders!inner(
            id,
            total_cents,
            status,
            order_items(quantity)
          ),
          tickets(
            id,
            status,
            redeemed_at
          ),
          event_posts(
            id,
            event_reactions(kind)
          ),
          scan_logs(
            id,
            result
          )
        `)
        .eq('owner_context_type', 'individual')
        .eq('owner_context_id', user.id);

      if (eventsError) throw eventsError;

      // Process event analytics
      const processedAnalytics: EventAnalytics[] = events?.map((event: any) => {
        const paidOrders = event.orders?.filter((o: any) => o.status === 'paid') || [];
        const totalRevenue = paidOrders.reduce((sum: number, order: any) => sum + order.total_cents, 0) / 100;
        const ticketSales = paidOrders.reduce((sum: number, order: any) => 
          sum + order.order_items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0), 0);
        
        const checkIns = event.scan_logs?.filter((log: any) => log.result === 'valid').length || 0;
        
        const reactions = event.event_posts?.flatMap((post: any) => post.event_reactions || []) || [];
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
      }) || [];

      setEventAnalytics(processedAnalytics);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalytics = () => {
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