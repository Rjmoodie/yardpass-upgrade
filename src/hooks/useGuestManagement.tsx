import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GuestData {
  email: string;
  name?: string;
  type: 'complimentary_ticket' | 'invite_only';
  tier_id?: string;
  notes?: string;
}

interface Guest {
  id: string;
  name: string;
  email: string;
  type: 'ticket' | 'invite';
  status: string;
  created_at: string;
  ticket_id?: string;
  invite_id?: string;
  tier_name?: string;
  is_complimentary?: boolean;
}

export function useGuestManagement(eventId: string) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadGuests = useCallback(async () => {
    setLoading(true);
    try {
      // Load ticket holders (including complimentary)
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          owner_user_id,
          status,
          created_at,
          qr_code,
          user_profiles!tickets_owner_user_id_fkey (
            display_name,
            user_id
          ),
          ticket_tiers (
            name,
            price_cents
          )
        `)
        .eq('event_id', eventId);

      if (ticketsError) throw ticketsError;

      // Load invited users
      const { data: invites, error: invitesError } = await supabase
        .from('event_invites')
        .select(`
          event_id,
          user_id,
          email,
          created_at,
          user_profiles!event_invites_user_id_fkey (
            display_name,
            user_id
          )
        `)
        .eq('event_id', eventId);

      if (invitesError) throw invitesError;

      // Combine and format data
      const guestList: Guest[] = [
        ...(tickets || []).map((ticket: any) => ({
          id: ticket.id,
          name: ticket.user_profiles?.display_name || 'Unknown User',
          email: '', // We don't have email in tickets, would need to join with auth.users
          type: 'ticket' as const,
          status: ticket.status,
          created_at: ticket.created_at,
          ticket_id: ticket.id,
          tier_name: ticket.ticket_tiers?.name,
          is_complimentary: ticket.ticket_tiers?.price_cents === 0
        })),
        ...(invites || []).map((invite: any) => ({
          id: `invite-${invite.user_id}`,
          name: invite.user_profiles?.display_name || 'Invited User',
          email: invite.email || '',
          type: 'invite' as const,
          status: 'invited',
          created_at: invite.created_at,
          invite_id: invite.user_id
        }))
      ];

      setGuests(guestList);
    } catch (error: any) {
      toast({
        title: "Error loading guests",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  const addGuest = useCallback(async (guestData: GuestData) => {
    setLoading(true);
    try {
      if (guestData.type === 'complimentary_ticket') {
        // Create a complimentary ticket
        if (!guestData.tier_id) {
          throw new Error('Ticket tier is required for complimentary tickets');
        }

        // First, try to find user by email
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_id')
          .ilike('display_name', `%${guestData.email}%`)
          .maybeSingle();

        let userId = profile?.user_id;

        if (!userId) {
          // If user doesn't exist, create an invite record instead
          const { error: inviteError } = await supabase
            .from('event_invites')
            .insert({
              event_id: eventId,
              user_id: crypto.randomUUID(), // Temporary ID for email-only invites
              email: guestData.email
            });

          if (inviteError) throw inviteError;

          toast({
            title: "Guest invited",
            description: `${guestData.email} has been invited to the event`,
          });
        } else {
          // Create complimentary ticket
          const { error: ticketError } = await supabase
            .from('tickets')
            .insert({
              event_id: eventId,
              owner_user_id: userId,
              tier_id: guestData.tier_id,
              status: 'issued',
              qr_code: `comp-${eventId}-${userId}-${Date.now()}`
            });

          if (ticketError) throw ticketError;

          toast({
            title: "Complimentary ticket created",
            description: `Ticket issued for ${guestData.name || guestData.email}`,
          });
        }
      } else {
        // Create invite-only access
        const { error } = await supabase
          .from('event_invites')
          .insert({
            event_id: eventId,
            user_id: crypto.randomUUID(), // Temporary ID for email-only invites
            email: guestData.email,
            role: 'viewer'
          });

        if (error) throw error;

        toast({
          title: "Guest invited",
          description: `${guestData.email} has been invited to the event`,
        });
      }

      await loadGuests(); // Refresh the list
    } catch (error: any) {
      toast({
        title: "Error adding guest",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, loadGuests, toast]);

  const removeGuest = useCallback(async (guest: Guest) => {
    setLoading(true);
    try {
      if (guest.type === 'ticket' && guest.ticket_id) {
        const { error } = await supabase
          .from('tickets')
          .delete()
          .eq('id', guest.ticket_id);

        if (error) throw error;
      } else if (guest.type === 'invite' && guest.invite_id) {
        const { error } = await supabase
          .from('event_invites')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', guest.invite_id);

        if (error) throw error;
      }

      toast({
        title: "Guest removed",
        description: `${guest.name} has been removed from the event`,
      });

      await loadGuests(); // Refresh the list
    } catch (error: any) {
      toast({
        title: "Error removing guest",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, loadGuests, toast]);

  return {
    guests,
    loading,
    loadGuests,
    addGuest,
    removeGuest
  };
}