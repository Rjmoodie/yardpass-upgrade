// Organizer analytics hook with caching and edge function support
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type EventAnalyticsRow = {
  event_id: string;
  event_title: string;
  ticket_sales?: number;
  total_revenue?: number;     // USD number (normalized from cents)
  total_attendees?: number;
  check_ins?: number;
  engagement_metrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
};

export type OverallAnalytics = {
  total_events: number;
  completed_events: number;
  total_attendees: number;
  total_revenue: number;      // USD number (normalized)
};

// Simple cache with 60s TTL
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 60_000; // 60 seconds

const numberOrZero = (val: any): number => (typeof val === 'number' && !isNaN(val)) ? val : 0;

export function useOrganizerAnalytics() {
  const { user } = useAuth();
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalyticsRow[]>([]);
  const [overallAnalytics, setOverallAnalytics] = useState<OverallAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController>();

  const fetchAnalytics = useCallback(async (period: '7d' | '30d' | '90d' = '30d') => {
    if (!user) return;

    const cacheKey = `organizer-${user.id}-${period}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setEventAnalytics(cached.data.events || []);
      setOverallAnalytics(cached.data.overall || null);
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // Try edge function first
      const { data, error: funcError } = await supabase.functions.invoke('analytics-organizer-overview', {
        body: { user_id: user.id, period }
      });

      if (data && !funcError) {
        const events = (data.events || []).map((event: any) => ({
          ...event,
          total_revenue: numberOrZero(event.total_revenue),
          ticket_sales: numberOrZero(event.ticket_sales),
          total_attendees: numberOrZero(event.total_attendees),
          check_ins: numberOrZero(event.check_ins),
          engagement_metrics: {
            likes: numberOrZero(event.engagement_metrics?.likes),
            comments: numberOrZero(event.engagement_metrics?.comments),
            shares: numberOrZero(event.engagement_metrics?.shares),
            views: numberOrZero(event.engagement_metrics?.views)
          }
        }));

        const overall = data.overall ? {
          total_events: numberOrZero(data.overall.total_events),
          completed_events: numberOrZero(data.overall.completed_events),
          total_attendees: numberOrZero(data.overall.total_attendees),
          total_revenue: numberOrZero(data.overall.total_revenue)
        } : null;

        setEventAnalytics(events);
        setOverallAnalytics(overall);
        cache.set(cacheKey, { data: { events, overall }, ts: Date.now() });
        return;
      }

      // Fallback to SQL queries
      console.warn('Edge function failed, using fallback queries:', funcError);
      
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, title, created_at, end_at')
        .eq('created_by', user.id);

      if (eventsError) throw eventsError;

      if (!events || events.length === 0) {
        const emptyResult = {
          events: [],
          overall: { total_events: 0, completed_events: 0, total_attendees: 0, total_revenue: 0 }
        };
        setEventAnalytics([]);
        setOverallAnalytics(emptyResult.overall);
        cache.set(cacheKey, { data: emptyResult, ts: Date.now() });
        return;
      }

      const eventIds = events.map(e => e.id);

      // Fetch orders and tickets
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          event_id, 
          total_cents, 
          status,
          order_items (quantity, tier_id)
        `)
        .in('event_id', eventIds)
        .eq('status', 'paid');

      const { data: tickets } = await supabase
        .from('tickets')
        .select('event_id, status')
        .in('event_id', eventIds);

      const { data: scanLogs } = await supabase
        .from('scan_logs')
        .select('event_id, result')
        .in('event_id', eventIds)
        .eq('result', 'valid');

      const { data: reactions } = await supabase
        .from('event_reactions')
        .select(`
          kind,
          event_posts!inner (event_id)
        `)
        .in('event_posts.event_id', eventIds);

      // Process data
      const analyticsMap = new Map<string, EventAnalyticsRow>();
      
      events.forEach(event => {
        analyticsMap.set(event.id, {
          event_id: event.id,
          event_title: event.title,
          ticket_sales: 0,
          total_revenue: 0,
          total_attendees: 0,
          check_ins: 0,
          engagement_metrics: { likes: 0, comments: 0, shares: 0, views: 0 }
        });
      });

      // Process orders
      orders?.forEach(order => {
        const analytics = analyticsMap.get(order.event_id);
        if (analytics) {
          analytics.total_revenue! += (order.total_cents || 0) / 100; // Convert to USD
          analytics.ticket_sales! += (order.order_items as any)?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
        }
      });

      // Process tickets for attendees
      tickets?.forEach(ticket => {
        const analytics = analyticsMap.get(ticket.event_id);
        if (analytics && ticket.status === 'issued') {
          analytics.total_attendees!++;
        }
      });

      // Process check-ins
      scanLogs?.forEach(scan => {
        const analytics = analyticsMap.get(scan.event_id);
        if (analytics) {
          analytics.check_ins!++;
        }
      });

      // Process reactions
      reactions?.forEach(reaction => {
        const eventId = (reaction.event_posts as any)?.event_id;
        const analytics = analyticsMap.get(eventId);
        if (analytics && analytics.engagement_metrics) {
          switch (reaction.kind) {
            case 'like':
              analytics.engagement_metrics.likes!++;
              break;
            case 'comment':
              analytics.engagement_metrics.comments!++;
              break;
            case 'share':
              analytics.engagement_metrics.shares!++;
              break;
          }
        }
      });

      const eventArray = Array.from(analyticsMap.values());
      const overall = {
        total_events: events.length,
        completed_events: events.filter(e => e.end_at && new Date(e.end_at) < new Date()).length,
        total_attendees: eventArray.reduce((sum, e) => sum + (e.total_attendees || 0), 0),
        total_revenue: eventArray.reduce((sum, e) => sum + (e.total_revenue || 0), 0)
      };

      setEventAnalytics(eventArray);
      setOverallAnalytics(overall);
      cache.set(cacheKey, { data: { events: eventArray, overall }, ts: Date.now() });

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Error fetching organizer analytics:', err);
      setError(err.message || 'Failed to fetch analytics');
      setEventAnalytics([]);
      setOverallAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshAnalytics = useCallback(async (period?: '7d' | '30d' | '90d') => {
    if (user) {
      const cacheKey = `organizer-${user.id}-${period || '30d'}`;
      cache.delete(cacheKey);
      await fetchAnalytics(period);
    }
  }, [user, fetchAnalytics]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    eventAnalytics,
    overallAnalytics,
    loading,
    error,
    refreshAnalytics
  };
}