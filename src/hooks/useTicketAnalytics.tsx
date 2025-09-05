import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TicketAnalyticsEvent {
  event_type: 'ticket_view' | 'qr_code_view' | 'ticket_share' | 'ticket_copy' | 'wallet_download';
  ticket_id: string;
  event_id: string;
  user_id: string;
  metadata?: Record<string, any>;
}

export function useTicketAnalytics() {
  const trackEvent = useCallback(async (event: TicketAnalyticsEvent) => {
    try {
      // Track in local analytics
      console.log('Ticket Analytics Event:', event);
      
      // Send to Supabase analytics (if you have an analytics table)
      const { error } = await supabase
        .from('ticket_analytics')
        .insert({
          event_type: event.event_type,
          ticket_id: event.ticket_id,
          event_id: event.event_id,
          user_id: event.user_id,
          metadata: event.metadata || {},
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Analytics tracking error:', error);
      }
    } catch (error) {
      console.error('Failed to track analytics event:', error);
    }
  }, []);

  const trackTicketView = useCallback((ticketId: string, eventId: string, userId: string) => {
    trackEvent({
      event_type: 'ticket_view',
      ticket_id: ticketId,
      event_id: eventId,
      user_id: userId,
      metadata: {
        timestamp: Date.now(),
        source: 'tickets_page'
      }
    });
  }, [trackEvent]);

  const trackQRCodeView = useCallback((ticketId: string, eventId: string, userId: string) => {
    trackEvent({
      event_type: 'qr_code_view',
      ticket_id: ticketId,
      event_id: eventId,
      user_id: userId,
      metadata: {
        timestamp: Date.now(),
        source: 'qr_modal'
      }
    });
  }, [trackEvent]);

  const trackTicketShare = useCallback((ticketId: string, eventId: string, userId: string, method: string) => {
    trackEvent({
      event_type: 'ticket_share',
      ticket_id: ticketId,
      event_id: eventId,
      user_id: userId,
      metadata: {
        timestamp: Date.now(),
        share_method: method
      }
    });
  }, [trackEvent]);

  const trackTicketCopy = useCallback((ticketId: string, eventId: string, userId: string) => {
    trackEvent({
      event_type: 'ticket_copy',
      ticket_id: ticketId,
      event_id: eventId,
      user_id: userId,
      metadata: {
        timestamp: Date.now(),
        source: 'qr_modal'
      }
    });
  }, [trackEvent]);

  const trackWalletDownload = useCallback((ticketId: string, eventId: string, userId: string) => {
    trackEvent({
      event_type: 'wallet_download',
      ticket_id: ticketId,
      event_id: eventId,
      user_id: userId,
      metadata: {
        timestamp: Date.now(),
        source: 'tickets_page'
      }
    });
  }, [trackEvent]);

  return {
    trackTicketView,
    trackQRCodeView,
    trackTicketShare,
    trackTicketCopy,
    trackWalletDownload
  };
}

// Profile analytics hook
export function useProfileAnalytics() {
  const trackEvent = useCallback(async (event: {
    event_type: 'profile_view' | 'role_toggle' | 'profile_edit' | 'profile_share';
    user_id: string;
    metadata?: Record<string, any>;
  }) => {
    try {
      console.log('Profile Analytics Event:', event);
      
      const { error } = await supabase
        .from('profile_analytics')
        .insert({
          event_type: event.event_type,
          user_id: event.user_id,
          metadata: event.metadata || {},
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Profile analytics tracking error:', error);
      }
    } catch (error) {
      console.error('Failed to track profile analytics event:', error);
    }
  }, []);

  const trackProfileView = useCallback((userId: string) => {
    trackEvent({
      event_type: 'profile_view',
      user_id: userId,
      metadata: {
        timestamp: Date.now(),
        source: 'profile_page'
      }
    });
  }, [trackEvent]);

  const trackRoleToggle = useCallback((userId: string, newRole: string) => {
    trackEvent({
      event_type: 'role_toggle',
      user_id: userId,
      metadata: {
        timestamp: Date.now(),
        new_role: newRole,
        source: 'profile_page'
      }
    });
  }, [trackEvent]);

  const trackProfileEdit = useCallback((userId: string, field: string) => {
    trackEvent({
      event_type: 'profile_edit',
      user_id: userId,
      metadata: {
        timestamp: Date.now(),
        edited_field: field,
        source: 'profile_page'
      }
    });
  }, [trackEvent]);

  const trackProfileShare = useCallback((userId: string, method: string) => {
    trackEvent({
      event_type: 'profile_share',
      user_id: userId,
      metadata: {
        timestamp: Date.now(),
        share_method: method,
        source: 'profile_page'
      }
    });
  }, [trackEvent]);

  return {
    trackProfileView,
    trackRoleToggle,
    trackProfileEdit,
    trackProfileShare
  };
}
