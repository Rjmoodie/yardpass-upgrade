import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GuestData {
  email: string;
  name?: string;
  type: 'complimentary_ticket' | 'invite_only' | 'guest_code';
  tier_id?: string;
  notes?: string;
  max_uses?: number;
  expires_at?: string;
}

interface GuestCode {
  id: string;
  code: string;
  tier_id?: string;
  max_uses: number;
  used_count: number;
  expires_at?: string;
  notes?: string;
  created_at: string;
  tier_name?: string;
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
  const [guestCodes, setGuestCodes] = useState<GuestCode[]>([]);
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
          tier_id
        `)
        .eq('event_id', eventId);

      // Get user profiles separately
      const userIds = [...new Set((tickets || []).map(t => t.owner_user_id))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      // Get ticket tiers separately  
      const tierIds = [...new Set((tickets || []).map(t => t.tier_id))];
      const { data: tiers } = await supabase
        .from('ticket_tiers')
        .select('id, name, price_cents')
        .in('id', tierIds);

      if (ticketsError) throw ticketsError;

      // Load invited users
      const { data: invites, error: invitesError } = await supabase
        .from('event_invites')
        .select(`
          event_id,
          user_id,
          email,
          created_at
        `)
        .eq('event_id', eventId);

      if (invitesError) throw invitesError;

      // Get user profiles for invites separately
      const inviteUserIds = [...new Set((invites || []).map(i => i.user_id))];
      const { data: inviteProfiles } = await supabase
        .from('user_profiles')
        .select('user_id, display_name')
        .in('user_id', inviteUserIds);

      // Create lookup maps
      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const tiersMap = new Map(tiers?.map(t => [t.id, t]) || []);
      const inviteProfilesMap = new Map(inviteProfiles?.map(p => [p.user_id, p]) || []);

      // Combine and format data
      const guestList: Guest[] = [
        ...(tickets || []).map((ticket: any) => {
          const profile = profilesMap.get(ticket.owner_user_id);
          const tier = tiersMap.get(ticket.tier_id);
          
          return {
            id: ticket.id,
            name: profile?.display_name || 'Unknown User',
            email: '', // We don't have email in tickets, would need to join with auth.users
            type: 'ticket' as const,
            status: ticket.status,
            created_at: ticket.created_at,
            ticket_id: ticket.id,
            tier_name: tier?.name,
            is_complimentary: tier?.price_cents === 0
          };
        }),
        ...(invites || []).map((invite: any) => {
          const profile = inviteProfilesMap.get(invite.user_id);
          
          return {
            id: `invite-${invite.user_id}`,
            name: profile?.display_name || 'Invited User',
            email: invite.email || '',
            type: 'invite' as const,
            status: 'invited',
            created_at: invite.created_at,
            invite_id: invite.user_id
          };
        })
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
          // Check if invite already exists
          const { data: existingInvite } = await supabase
            .from('event_invites')
            .select('email')
            .eq('event_id', eventId)
            .eq('email', guestData.email)
            .maybeSingle();

          if (existingInvite) {
            toast({
              title: "Guest already invited",
              description: `${guestData.email} is already invited to this event`,
              variant: "default",
            });
            return;
          }

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
          // Create complimentary order first (required for tickets.order_id FK)
          const { data: compOrder, error: orderError } = await supabase
            .from('orders')
            .insert({
              event_id: eventId,
              user_id: userId,
              total_cents: 0,
              status: 'paid',
              paid_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (orderError || !compOrder) throw orderError || new Error('Failed to create complimentary order');

          // Create complimentary ticket (qr_code and serial_no auto-generated by DB)
          const { error: ticketError } = await supabase
            .from('tickets')
            .insert({
              order_id: compOrder.id,
              event_id: eventId,
              owner_user_id: userId,
              tier_id: guestData.tier_id,
              status: 'issued'
              // qr_code and serial_no auto-assigned by trg_assign_serial_no and gen_qr_code()
            } as any); // Type assertion until Supabase types regenerate

          if (ticketError) throw ticketError;

          toast({
            title: "Complimentary ticket created",
            description: `Ticket issued for ${guestData.name || guestData.email}`,
          });
        }
      } else if (guestData.type === 'guest_code') {
        // Generate a guest code
        const code = `GUEST${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        const { error } = await supabase
          .from('guest_codes')
          .insert({
            event_id: eventId,
            code,
            tier_id: guestData.tier_id,
            max_uses: guestData.max_uses || 1,
            expires_at: guestData.expires_at,
            created_by: (await supabase.auth.getUser()).data.user?.id!,
            notes: guestData.notes
          });

        if (error) throw error;

        toast({
          title: "Guest code created",
          description: `Code: ${code}`,
        });

        await loadGuestCodes();
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

  const loadGuestCodes = useCallback(async () => {
    setLoading(true);
    try {
      const { data: codes, error } = await supabase
        .from('guest_codes')
        .select(`
          id,
          code,
          tier_id,
          max_uses,
          used_count,
          expires_at,
          notes,
          created_at
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get tier names separately if tier_ids exist
      const codeTierIds = [...new Set((codes || []).filter(c => c.tier_id).map(c => c.tier_id))];
      const { data: codeTiers } = codeTierIds.length > 0 ? await supabase
        .from('ticket_tiers')
        .select('id, name')
        .in('id', codeTierIds) : { data: [] };

      const codeTiersMap = new Map((codeTiers || []).map((t: any) => [t.id, t]));

      const formattedCodes: GuestCode[] = (codes || []).map((code: any) => ({
        id: code.id,
        code: code.code,
        tier_id: code.tier_id,
        max_uses: code.max_uses,
        used_count: code.used_count,
        expires_at: code.expires_at,
        notes: code.notes,
        created_at: code.created_at,
        tier_name: code.tier_id ? (codeTiersMap.get(code.tier_id) as any)?.name : undefined
      }));

      setGuestCodes(formattedCodes);
    } catch (error: any) {
      toast({
        title: "Error loading guest codes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  const removeGuestCode = useCallback(async (codeId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('guest_codes')
        .delete()
        .eq('id', codeId);

      if (error) throw error;

      toast({
        title: "Guest code removed",
        description: "The guest code has been deleted",
      });

      await loadGuestCodes();
    } catch (error: any) {
      toast({
        title: "Error removing guest code",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [loadGuestCodes, toast]);

  return {
    guests,
    guestCodes,
    loading,
    loadGuests,
    loadGuestCodes,
    addGuest,
    removeGuest,
    removeGuestCode
  };
}