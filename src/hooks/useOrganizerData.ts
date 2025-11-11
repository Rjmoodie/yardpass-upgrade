import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { startTracking, endTracking } from '@/utils/performanceTracking';

interface Event {
  id: string;
  title: string;
  status: string;
  date: string;
  attendees: number;
  revenue: number;
  views: number;
  likes: number;
  shares: number;
  tickets_sold: number;
  capacity: number;
  check_ins?: number;
  conversion_rate: number;
  engagement_rate: number;
  created_at: string;
  start_at: string;
  end_at: string;
  venue?: string;
  category?: string;
  cover_image_url?: string;
  description?: string;
  city?: string;
  visibility?: string;
}


export function useOrganizerData(user: any) {
  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { trackEvent } = useAnalyticsIntegration();

  const fetchUserEvents = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 Fetching events for user:', user.id);
      setLoading(true);
      
      // 🎯 PERF-001: Start tracking dashboard load
      startTracking('dashboard_load');

      // Fetch events with ticket sales data
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          title,
          start_at,
          end_at,
          venue,
          category,
          cover_image_url,
          created_at,
          description,
          city,
          visibility,
          ticket_tiers!fk_ticket_tiers_event_id (
            id,
            name,
            price_cents,
            quantity,
            badge_label
          )
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (eventsError) {
        console.error('Error loading user events:', eventsError);
        setUserEvents([]);
        return;
      }

      console.log('📊 Events query result:', { data: eventsData, count: eventsData?.length });

      // 🎯 PERF-002: Batch all queries to eliminate N+1 pattern
      // Instead of 4 queries per event, make 4 queries total
      
      const eventIds = eventsData.map(e => e.id);
      
      if (eventIds.length === 0) {
        setUserEvents([]);
        endTracking('dashboard_load', { eventCount: 0 });
        return;
      }

      console.log('🚀 [PERF-002] Batching queries for', eventIds.length, 'events');

      // Batch all queries in parallel (4 queries instead of N×4)
      const [ticketsResult, ordersResult, scansResult, reactionsResult] = await Promise.all([
        supabase
          .from('tickets')
          .select('event_id, status, tier_id')
          .in('event_id', eventIds),
        
        supabase
          .from('orders')
          .select('event_id, total_cents, status')
          .in('event_id', eventIds)
          .eq('status', 'paid'),
        
        supabase
          .from('scan_logs')
          .select('event_id, id')
          .in('event_id', eventIds)
          .eq('result', 'valid'),
        
        supabase
          .from('event_reactions')
          .select('kind, event_posts!inner(event_id)')
          .in('event_posts.event_id', eventIds)
      ]);

      // Group results by event_id for O(1) lookups
      const ticketsByEvent = new Map<string, any[]>();
      ticketsResult.data?.forEach(ticket => {
        if (!ticketsByEvent.has(ticket.event_id)) {
          ticketsByEvent.set(ticket.event_id, []);
        }
        ticketsByEvent.get(ticket.event_id)!.push(ticket);
      });

      const ordersByEvent = new Map<string, any[]>();
      ordersResult.data?.forEach(order => {
        if (!ordersByEvent.has(order.event_id)) {
          ordersByEvent.set(order.event_id, []);
        }
        ordersByEvent.get(order.event_id)!.push(order);
      });

      const scansByEvent = new Map<string, any[]>();
      scansResult.data?.forEach(scan => {
        if (!scansByEvent.has(scan.event_id)) {
          scansByEvent.set(scan.event_id, []);
        }
        scansByEvent.get(scan.event_id)!.push(scan);
      });

      const reactionsByEvent = new Map<string, any[]>();
      reactionsResult.data?.forEach((reaction: any) => {
        const eventId = reaction.event_posts?.event_id;
        if (eventId) {
          if (!reactionsByEvent.has(eventId)) {
            reactionsByEvent.set(eventId, []);
          }
          reactionsByEvent.get(eventId)!.push(reaction);
        }
      });

      console.log('✅ [PERF-002] Batched queries complete:', {
        tickets: ticketsResult.data?.length || 0,
        orders: ordersResult.data?.length || 0,
        scans: scansResult.data?.length || 0,
        reactions: reactionsResult.data?.length || 0
      });

      // Transform events with O(1) lookups (no more async queries!)
      const transformedEvents = eventsData.map(event => {
        const ticketTiers = event.ticket_tiers || [];
        const totalCapacity = ticketTiers.reduce((sum: number, tier: any) => sum + (tier.quantity || 0), 0);

        // O(1) lookups instead of queries
        const tickets = ticketsByEvent.get(event.id) || [];
        const orders = ordersByEvent.get(event.id) || [];
        const scans = scansByEvent.get(event.id) || [];
        const reactions = reactionsByEvent.get(event.id) || [];

        // Calculate metrics from grouped data
        const totalSold = tickets.filter(t => t.status === 'issued').length;
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total_cents || 0), 0);
        const checkIns = scans.length;
        const likes = reactions.filter((r: any) => r.kind === 'like').length;
        const totalReactions = reactions.length;

        return {
          id: event.id,
          title: event.title,
          status: new Date(event.start_at) > new Date() ? 'published' : 'completed',
          date: new Date(event.start_at).toLocaleDateString(),
          attendees: totalSold,
          revenue: totalRevenue / 100, // Convert cents to dollars
          views: Math.floor(Math.random() * 10000) + totalSold * 10, // Better mock based on attendees
          likes: likes,
          shares: Math.floor(totalReactions * 0.1), // Estimate shares from reactions
          tickets_sold: totalSold,
          capacity: totalCapacity,
          check_ins: checkIns,
          conversion_rate: totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0,
          engagement_rate: totalSold > 0 ? (totalReactions / totalSold) * 100 : 0,
          created_at: event.created_at || new Date().toISOString(),
          start_at: event.start_at,
          end_at: event.end_at,
          venue: event.venue || '',
          category: event.category || '',
          cover_image_url: event.cover_image_url || '',
          description: event.description || '',
          city: event.city || '',
          visibility: event.visibility || 'public'
        };
      });
      
      setUserEvents(transformedEvents);
      
      // 🎯 PERF-001: End tracking with metadata
      endTracking('dashboard_load', {
        eventCount: transformedEvents.length,
        totalRevenue: transformedEvents.reduce((sum, e) => sum + e.revenue, 0),
        totalTicketsSold: transformedEvents.reduce((sum, e) => sum + e.tickets_sold, 0)
      });
      
    } catch (error) {
      console.error('Error in fetchUserEvents:', error);
      setUserEvents([]);
      
      // Track failed loads too
      endTracking('dashboard_load', { error: true });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUserEvents();
  }, [fetchUserEvents]);

  return {
    userEvents,
    loading,
    refetchEvents: fetchUserEvents
  };
}