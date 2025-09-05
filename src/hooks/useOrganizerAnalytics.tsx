import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface EventAnalytics {
  event_id: string;
  event_title: string;
  total_revenue: number;
  total_attendees: number;
  ticket_sales: number;
  check_ins: number;
  engagement_metrics: {
    likes: number;
    comments: number;
    shares: number;
  };
  refunds: {
    count: number;
    amount: number;
  };
}

interface OverallAnalytics {
  total_revenue: number;
  total_attendees: number;
  total_events: number;
  completed_events: number;
}

export function useOrganizerAnalytics() {
  const { user } = useAuth();
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalytics[]>([]);
  const [overallAnalytics, setOverallAnalytics] = useState<OverallAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch events created by the user
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, title, created_at')
        .eq('created_by', user.id);

      if (eventsError) throw eventsError;

      if (!events || events.length === 0) {
        setEventAnalytics([]);
        setOverallAnalytics({
          total_revenue: 0,
          total_attendees: 0,
          total_events: 0,
          completed_events: 0
        });
        return;
      }

      const eventIds = events.map(e => e.id);

      // Fetch ticket sales and revenue
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          event_id,
          status,
          ticket_tiers!fk_tickets_tier_id (
            price_cents
          )
        `)
        .in('event_id', eventIds);

      if (ticketError) throw ticketError;

      // Fetch check-ins
      const { data: checkInData, error: checkInError } = await supabase
        .from('ticket_scans')
        .select('event_id, ticket_id')
        .in('event_id', eventIds);

      if (checkInError) throw checkInError;

      // Fetch engagement metrics
      const { data: engagementData, error: engagementError } = await supabase
        .from('event_reactions')
        .select('post_id, kind, event_posts!fk_event_reactions_post_id (event_id)')
        .in('event_posts.event_id', eventIds);

      if (engagementError) throw engagementError;

      // Process analytics data
      const analyticsMap = new Map<string, EventAnalytics>();

      // Initialize analytics for each event
      events.forEach(event => {
        analyticsMap.set(event.id, {
          event_id: event.id,
          event_title: event.title,
          total_revenue: 0,
          total_attendees: 0,
          ticket_sales: 0,
          check_ins: 0,
          engagement_metrics: {
            likes: 0,
            comments: 0,
            shares: 0
          },
          refunds: {
            count: 0,
            amount: 0
          }
        });
      });

      // Process ticket data
      ticketData?.forEach(ticket => {
        const analytics = analyticsMap.get(ticket.event_id);
        if (analytics) {
          analytics.total_attendees++;
          if (ticket.status === 'issued') {
            analytics.ticket_sales++;
            analytics.total_revenue += (ticket.ticket_tiers as any)?.price_cents || 0;
          }
        }
      });

      // Process check-in data
      checkInData?.forEach(scan => {
        const analytics = analyticsMap.get(scan.event_id);
        if (analytics) {
          analytics.check_ins++;
        }
      });

      // Process engagement data
      engagementData?.forEach(reaction => {
        const eventId = (reaction.event_posts as any)?.event_id;
        if (eventId) {
          const analytics = analyticsMap.get(eventId);
          if (analytics) {
            switch (reaction.kind) {
              case 'like':
                analytics.engagement_metrics.likes++;
                break;
              case 'comment':
                analytics.engagement_metrics.comments++;
                break;
              case 'share':
                analytics.engagement_metrics.shares++;
                break;
            }
          }
        }
      });

      const eventAnalyticsArray = Array.from(analyticsMap.values());

      // Calculate overall analytics
      const overall = eventAnalyticsArray.reduce((acc, event) => ({
        total_revenue: acc.total_revenue + event.total_revenue,
        total_attendees: acc.total_attendees + event.total_attendees,
        total_events: acc.total_events + 1,
        completed_events: acc.completed_events + (event.check_ins > 0 ? 1 : 0)
      }), {
        total_revenue: 0,
        total_attendees: 0,
        total_events: 0,
        completed_events: 0
      });

      setEventAnalytics(eventAnalyticsArray);
      setOverallAnalytics(overall);

    } catch (err: unknown) {
      console.error('Error fetching organizer analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      setEventAnalytics([]);
      setOverallAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [user]);

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