import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTicketCache } from './useOfflineCache';

export interface UserTicket {
  id: string;
  eventId: string;
  eventTitle: string;

  // Human-readable
  eventDate: string;   // "Friday, July 12, 2025"
  eventTime: string;   // "7:00 PM"
  eventLocation: string; // "Venue, City"
  venue: string;
  city: string;

  // Raw time data (for ICS / logic)
  startAtISO: string;     // ISO
  endAtISO: string;       // ISO (fallback +2h if missing)
  timezone?: string;      // Olson TZ name if provided

  coverImage: string;
  ticketType: string;
  badge: string;
  qrCode: string;
  status: string;
  price: number;          // USD number
  orderDate: string;      // ISO from order or ticket created
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

  const setPartial = (patch: Partial<FetchState>) =>
    setState((s) => ({ ...s, ...patch }));

  const transform = (rows: any[]): UserTicket[] => {
    const now = new Date();

    return (rows || []).map((ticket: any) => {
      const ev = ticket.events || {};
      const startISO: string = ev.start_at ?? new Date().toISOString();
      const endISO: string = ev.end_at ?? new Date(new Date(startISO).getTime() + 2 * 60 * 60 * 1000).toISOString();

      const start = new Date(startISO);

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
        venue: ev.venue || 'TBA',
        city: ev.city || '',
        eventLocation: `${ev.venue || 'TBA'}${ev.city ? `, ${ev.city}` : ''}`,
        coverImage:
          ev.cover_image_url ||
          'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
        ticketType: ticket.ticket_tiers?.name || 'General',
        badge: ticket.ticket_tiers?.badge_label || 'GA',
        qrCode: ticket.qr_code,
        status: ticket.status,
        price: (ticket.ticket_tiers?.price_cents || 0) / 100,
        orderDate: ticket.orders?.created_at || ticket.created_at,
        isUpcoming: new Date(endISO) > now,
        organizerName: 'Event Organizer',
        startAtISO: startISO,
        endAtISO: endISO,
        timezone: ev.timezone || undefined,
      } as UserTicket;
    });
  };

  const fetchUserTickets = async () => {
    if (!user) {
      setPartial({ tickets: [], loading: false, error: null });
      return;
    }

    try {
      setPartial({ loading: true, error: null });

      // Offline path first
      if (!navigator.onLine) {
        const cached = cache.getCachedTicketList();
        if (Array.isArray(cached) && cached.length) {
          setPartial({ tickets: cached as any, loading: false, isOffline: true });
          toast({
            title: 'Offline Mode',
            description: 'Showing cached tickets. Some data may be outdated.',
          });
          return;
        }
        setPartial({
          error: 'No internet connection and no cached tickets available',
          loading: false,
          isOffline: true,
        });
        return;
      }

      // Online fetch
      const { data, error } = await supabase.functions.invoke('get-user-tickets');
      if (error) throw error;

      const transformed = transform(data?.tickets || []);
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
          variant: 'destructive',
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
  };

  // Refresh public API
  const refreshTickets = async () => {
    await fetchUserTickets();
  };

  // Online/offline listeners
  useEffect(() => {
    const goOnline = () => {
      setPartial({ isOffline: false });
      fetchUserTickets();
    };
    const goOffline = () => {
      setPartial({ isOffline: true });
      toast({
        title: 'Offline',
        description: 'You lost internet connection. Showing cached data if available.',
      });
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // First load
  useEffect(() => {
    fetchUserTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Realtime (optional): keep local list fresh when tickets change
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
        () => fetchUserTickets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  };
}
