import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTicketCache } from './useOfflineCache';

export interface UserTicket {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  city: string;
  eventLocation: string;
  coverImage: string;
  ticketType: string;
  badge: string;
  qrCode: string;
  status: string;
  price: number;
  orderDate: string;
  isUpcoming: boolean;
  organizerName?: string;
}

export function useTickets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const ticketCache = useTicketCache();

  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // keep online state current
  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const transform = useCallback((raw: any): UserTicket => {
    const startAt = raw?.events?.start_at ? new Date(raw.events.start_at) : new Date();
    const now = new Date();
    const title = raw?.events?.title || 'Event';
    const venue = raw?.events?.venue || 'TBA';
    const city = raw?.events?.city || '';

    return {
      id: raw.id,
      eventId: raw.events?.id || '',
      eventTitle: title,
      eventDate: startAt.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }),
      eventTime: startAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      venue,
      city,
      eventLocation: city ? `${venue}, ${city}` : venue,
      coverImage: raw.events?.cover_image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
      ticketType: raw.ticket_tiers?.name || 'General',
      badge: raw.ticket_tiers?.badge_label || 'GA',
      qrCode: raw.qr_code,
      status: raw.status,
      price: (raw.ticket_tiers?.price_cents || 0) / 100,
      orderDate: raw.orders?.created_at || raw.created_at,
      isUpcoming: startAt > now,
      organizerName: raw.events?.organizer_name || 'Event Organizer'
    };
  }, []);

  const fetchUserTickets = useCallback(async () => {
    if (!user) {
      setTickets([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Offline: prefer cache
      if (!navigator.onLine) {
        const cached = ticketCache.getCachedTicketList();
        if (Array.isArray(cached) && cached.length > 0) {
          setTickets((cached as UserTicket[]).slice());
          toast({ title: "Offline Mode", description: "Showing cached tickets. Some data may be outdated." });
          return;
        } else {
          setError('No internet connection and no cached tickets available');
          return;
        }
      }

      const { data, error: fetchError } = await supabase.functions.invoke('get-user-tickets');
      if (fetchError) throw fetchError;

      const rows: any[] = data?.tickets || [];
      const transformed = rows.map(transform);

      // Sort by event date ascending for upcoming first
      const sorted = transformed.sort((a, b) => {
        const da = new Date(a.eventDate + ' ' + a.eventTime).getTime();
        const db = new Date(b.eventDate + ' ' + b.eventTime).getTime();
        return da - db;
      });

      setTickets(sorted);

      // Cache for offline use
      ticketCache.cacheTicketList(sorted as any);
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
      // Try cached data
      const cached = ticketCache.getCachedTicketList();
      if (Array.isArray(cached) && cached.length > 0) {
        setTickets((cached as UserTicket[]).slice());
        toast({
          title: "Using Cached Data",
          description: "Network error. Showing cached tickets.",
          variant: "destructive",
        });
      } else {
        setError(err.message || 'Failed to fetch tickets');
        toast({
          title: "Error Loading Tickets",
          description: err.message || 'Failed to fetch tickets',
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [ticketCache, toast, transform, user]);

  const refreshTickets = useCallback(() => {
    fetchUserTickets();
  }, [fetchUserTickets]);

  useEffect(() => {
    fetchUserTickets();
  }, [fetchUserTickets]);

  const upcomingTickets = tickets.filter(t => t.isUpcoming);
  const pastTickets = tickets.filter(t => !t.isUpcoming);

  const getTicketById = useCallback((id: string) => tickets.find(t => t.id === id) || null, [tickets]);

  return {
    tickets,
    upcomingTickets,
    pastTickets,
    loading,
    error,
    isOffline,
    refreshTickets,
    getTicketById,
  };
}
