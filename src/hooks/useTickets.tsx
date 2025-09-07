// src/hooks/useTickets.tsx

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTicketCache } from './useOfflineCache';

export interface UserTicket {
  id: string;
  eventId: string;
  eventTitle: string;

  // Human-readable
  eventDate: string;        // "Friday, July 12, 2025"
  eventTime: string;        // "7:00 PM"
  eventLocation: string;    // "Venue, City"
  venue: string;
  city: string;

  // Raw time data (for ICS / logic)
  startAtISO: string;       // ISO
  endAtISO: string;         // ISO (fallback +2h if missing)
  timezone?: string;

  coverImage: string;
  ticketType: string;
  badge: string;
  qrCode: string;
  status: string;
  price: number;            // USD number
  orderDate: string;        // ISO
  isUpcoming: boolean;
  organizerName?: string;
}

type FetchState = {
  tickets: UserTicket[];
  loading: boolean;
  error: string | null;
  isOffline: boolean;
};

export function useTickets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const cache = useTicketCache();

  const [state, setState] = useState<FetchState>({
    tickets: [],
    loading: true,
    error: null,
    isOffline: !navigator.onLine,
  });

  // Prevent race conditions between quick re-fetches
  const inFlight = useRef(0);
  const lastToast = useRef<number>(0);

  const setPartial = (patch: Partial<FetchState>) =>
    setState((s) => ({ ...s, ...patch }));

  const safeDate = (iso?: string | null) => {
    const d = iso ? new Date(iso) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };

  const transform = useCallback((rows: any[]): UserTicket[] => {
    const now = new Date();

    return (rows || []).map((ticket: any) => {
      const ev = ticket.events || {};
      const startISO: string = ev.start_at ?? new Date().toISOString();
      const endISO: string =
        ev.end_at ?? new Date(new Date(startISO).getTime() + 2 * 60 * 60 * 1000).toISOString();

      const start = safeDate(startISO);
      const end = safeDate(endISO);

      const venue = ev.venue || 'TBA';
      const city = ev.city || '';

      return {
        id: ticket.id,
        eventId: ev.id || '',
        eventTitle: ev.title || 'Event',
        eventDate: start.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        eventTime: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        venue,
        city,
        eventLocation: `${venue}${city ? `, ${city}` : ''}`,
        coverImage:
          ev.cover_image_url ||
          'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
        ticketType: ticket.ticket_tiers?.name || 'General',
        badge: ticket.ticket_tiers?.badge_label || 'GA',
        qrCode: ticket.qr_code,
        status: ticket.status,
        price: (ticket.ticket_tiers?.price_cents || 0) / 100,
        orderDate: ticket.orders?.created_at || ticket.created_at,
        isUpcoming: end > now,
        organizerName: ev.user_profiles?.display_name || 'Event Organizer',
        startAtISO: startISO,
        endAtISO: endISO,
        timezone: ev.timezone || undefined,
      } as UserTicket;
    });
  }, []);

  // Use refs to avoid infinite loops
  const fetchRef = useRef<() => Promise<void>>();
  
  const fetchUserTickets = useCallback(async () => {
    if (!user) {
      setPartial({ tickets: [], loading: false, error: null });
      return;
    }

    const requestId = ++inFlight.current;

    try {
      setPartial({ loading: true, error: null });

      // Offline-first
      if (!navigator.onLine) {
        const cached = cache.getCachedTicketList();
        if (Array.isArray(cached) && cached.length) {
          setPartial({ tickets: cached as any, loading: false, isOffline: true });
          const now = Date.now();
          if (now - lastToast.current > 2500) {
            toast({
              title: 'Offline Mode',
              description: 'Showing cached tickets. Some data may be outdated.',
            });
            lastToast.current = now;
          }
          return;
        }
        setPartial({
          error: 'No internet connection and no cached tickets available',
          loading: false,
          isOffline: true,
        });
        return;
      }

      // Online fetch (requires a session)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No valid session found. Please log in again.');

      const { data, error } = await supabase.functions.invoke('get-user-tickets', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      console.log('🎫 get-user-tickets response:', { data, error });
      console.log('🎫 Full response data structure:', JSON.stringify(data, null, 2));
      if (error) throw error;

      // Ignore outdated responses
      if (requestId !== inFlight.current) return;

      const tickets = data?.tickets || data || [];
      console.log('🎫 Extracted tickets:', tickets);
      const transformed = transform(tickets);
      console.log('🎫 Raw tickets from API:', tickets);
      console.log('🎫 Transformed tickets:', transformed);
      const nowMs = Date.now();
      transformed.sort((a, b) => {
        const aStart = new Date(a.startAtISO).getTime();
        const bStart = new Date(b.startAtISO).getTime();
        const aUp = aStart >= nowMs;
        const bUp = bStart >= nowMs;
        if (aUp && bUp) return aStart - bStart;
        if (!aUp && !bUp) return bStart - aStart;
        return aUp ? -1 : 1;
      });

      setPartial({ tickets: transformed, loading: false, isOffline: false });

      // Cache for offline
      cache.cacheTicketList(transformed as any);
    } catch (e: any) {
      console.error('Error fetching tickets:', e);

      // Try cached
      const cached = cache.getCachedTicketList();
      if (Array.isArray(cached) && cached.length) {
        setPartial({ tickets: cached as any, loading: false, isOffline: !navigator.onLine });
        toast({
          title: 'Using Cached Data',
          description: e?.message || 'Network error. Showing cached tickets.',
        });
      } else {
        setPartial({
          loading: false,
          error: e?.message || 'Failed to fetch tickets',
          isOffline: !navigator.onLine,
        });
        toast({
          title: 'Error Loading Tickets',
          description: e?.message || 'Failed to fetch tickets',
          variant: 'destructive',
        });
      }
    }
  }, [user, cache, toast, transform]);
  
  // Store stable reference
  fetchRef.current = fetchUserTickets;

  // Public API
  const refreshTickets = useCallback(async () => {
    console.log('🔄 Refreshing tickets...');
    await fetchUserTickets();
  }, [fetchUserTickets]);

  // Force refresh tickets (bypasses cache)
  const forceRefreshTickets = useCallback(async () => {
    if (!user) return;
    
    console.log('🔄 Force refreshing tickets...');
    setPartial({ loading: true, error: null });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No valid session found. Please log in again.');

      const { data, error } = await supabase.functions.invoke('get-user-tickets', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      console.log('🔄 Force refresh - get-user-tickets response:', { data, error });
      console.log('🔄 Force refresh - Full response data structure:', JSON.stringify(data, null, 2));
      if (error) throw error;

      const tickets = data?.tickets || data || [];
      console.log('🔄 Force refresh - Extracted tickets:', tickets);
      const transformed = transform(tickets);
      console.log('🎫 Force refresh - Raw tickets from API:', tickets);
      console.log('🎫 Force refresh - Transformed tickets:', transformed);
      const nowMs = Date.now();
      transformed.sort((a, b) => {
        const aStart = new Date(a.startAtISO).getTime();
        const bStart = new Date(b.startAtISO).getTime();
        const aUp = aStart >= nowMs;
        const bUp = bStart >= nowMs;
        if (aUp && bUp) return aStart - bStart;
        if (!aUp && !bUp) return bStart - aStart;
        return aUp ? -1 : 1;
      });

      setPartial({ tickets: transformed, loading: false, isOffline: false });
      cache.cacheTicketList(transformed as any);
      
      console.log('✅ Tickets refreshed successfully:', transformed.length);
    } catch (e: any) {
      console.error('❌ Error force refreshing tickets:', e);
      setPartial({
        loading: false,
        error: e?.message || 'Failed to refresh tickets',
      });
    }
  }, [user, transform, cache]);

  // Online/offline listeners
  useEffect(() => {
    const goOnline = () => {
      setPartial({ isOffline: false });
      if (fetchRef.current) fetchRef.current();
    };
    const goOffline = () => {
      setPartial({ isOffline: true });
      const now = Date.now();
      if (now - lastToast.current > 2500) {
        toast({
          title: 'Offline',
          description: 'You lost internet connection. Showing cached data if available.',
        });
        lastToast.current = now;
      }
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [toast]);

  // First load
  useEffect(() => {
    if (fetchRef.current) fetchRef.current();
  }, [user?.id]);

  // Realtime: keep local list fresh when user's tickets change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('tickets-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `owner_user_id=eq.${user.id}`,
        },
        () => {
          if (fetchRef.current) fetchRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const upcomingTickets = useMemo(
    () => state.tickets.filter((t) => t.isUpcoming),
    [state.tickets]
  );

  const pastTickets = useMemo(
    () => state.tickets.filter((t) => !t.isUpcoming),
    [state.tickets]
  );

  return {
    tickets: state.tickets,
    upcomingTickets,
    pastTickets,
    loading: state.loading,
    error: state.error,
    isOffline: state.isOffline,
    refreshTickets,
    forceRefreshTickets,
  };
}
