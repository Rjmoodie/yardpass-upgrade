import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserTickets = async () => {
    if (!user) {
      setTickets([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.functions.invoke('get-user-tickets');

      if (fetchError) throw fetchError;

      // Transform tickets to UI format
      const transformedTickets: UserTicket[] = (data.tickets || []).map((ticket: any) => {
        const eventDate = new Date(ticket.events?.start_at);
        const now = new Date();
        
        return {
          id: ticket.id,
          eventId: ticket.events?.id || '',
          eventTitle: ticket.events?.title || 'Event',
          eventDate: eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          eventTime: eventDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
          }),
          venue: ticket.events?.venue || 'TBA',
          city: ticket.events?.city || '',
          eventLocation: `${ticket.events?.venue || 'TBA'}${ticket.events?.city ? ', ' + ticket.events.city : ''}`,
          coverImage: ticket.events?.cover_image_url || 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
          ticketType: ticket.ticket_tiers?.name || 'General',
          badge: ticket.ticket_tiers?.badge_label || 'GA',
          qrCode: ticket.qr_code,
          status: ticket.status,
          price: (ticket.ticket_tiers?.price_cents || 0) / 100,
          orderDate: ticket.orders?.created_at || ticket.created_at,
          isUpcoming: eventDate > now,
          organizerName: 'Event Organizer'
        };
      });

      setTickets(transformedTickets);
    } catch (error: any) {
      console.error('Error fetching tickets:', error);
      setError(error.message || 'Failed to fetch tickets');
      toast({
        title: "Error Loading Tickets",
        description: error.message || 'Failed to fetch tickets',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshTickets = () => {
    fetchUserTickets();
  };

  useEffect(() => {
    fetchUserTickets();
  }, [user]);

  const upcomingTickets = tickets.filter(ticket => ticket.isUpcoming);
  const pastTickets = tickets.filter(ticket => !ticket.isUpcoming);

  return {
    tickets,
    upcomingTickets,
    pastTickets,
    loading,
    error,
    refreshTickets
  };
}