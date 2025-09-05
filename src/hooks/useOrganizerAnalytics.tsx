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

      // First check if there are any events at all
      const { data: allEvents, error: allEventsError } = await supabase
        .from('events')
        .select('id, title, owner_context_type, owner_context_id, created_by')
        .limit(10);

      console.log('All events (limited):', { allEvents, allEventsError });

      // Now fetch user's events with debugging
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, title, created_at, start_at, end_at, completed_at, owner_context_type, owner_context_id, created_by')
        .eq('owner_context_type', 'individual')
        .eq('owner_context_id', user.id);

      console.log('Events query result:', { events, eventsError, userId: user.id, ownerContextType: 'individual' });

      if (eventsError) {
        console.error('Events fetch error:', eventsError);
        throw eventsError;
      }

      console.log('Events data:', events);

      // Process event analytics - simplified for now
      const processedAnalytics: EventAnalytics[] = events?.map((event: any) => {
        return {
          event_id: event.id,
          event_title: event.title,
          total_revenue: 0, // Will be populated from overall analytics for now
          total_attendees: 0, // Will be populated from overall analytics for now
          ticket_sales: 0,
          total_views: 0,
          engagement_metrics: {
            likes: 0,
            comments: 0,
            shares: 0
          },
          check_ins: 0,
          refunds: {
            count: 0,
            amount: 0
          }
        };
      }) || [];

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