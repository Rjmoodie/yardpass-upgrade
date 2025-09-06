import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type TicketEventType = 'ticket_view' | 'qr_code_view' | 'ticket_share' | 'ticket_copy' | 'wallet_download';

interface TicketAnalyticsEvent {
  event_type: TicketEventType;
  ticket_id: string;
  event_id: string;
  user_id: string;
  metadata?: Record<string, any>;
}

// simple in-memory dedupe cache by key for 10s
function useDeduper(ttlMs = 10_000) {
  const mapRef = useRef<Map<string, number>>(new Map());
  const seen = (key: string) => {
    const now = Date.now();
    const last = mapRef.current.get(key) ?? 0;
    if (now - last < ttlMs) return true;
    mapRef.current.set(key, now);
    return false;
  };
  return seen;
}

export function useTicketAnalytics() {
  const seen = useDeduper();

  const trackEvent = useCallback(async (event: TicketAnalyticsEvent) => {
    const key = `${event.event_type}:${event.ticket_id}:${event.user_id}`;
    if (seen(key)) return;

    try {
      // Local console for development
      console.log('Ticket Analytics Event:', event);

      // Optional: try to persist (safe-noop if table doesn’t exist)
      const { error } = await supabase.from('ticket_analytics').insert({
        type: event.event_type,
        ticket_id: event.ticket_id,
        event_id: event.event_id,
        user_id: event.user_id,
        metadata: event.metadata ?? {},
        created_at: new Date().toISOString()
      } as any);

      if (error) {
        // Swallow schema errors to avoid breaking UX
        if (!`${error.message}`.toLowerCase().includes('relation') &&
            !`${error.message}`.toLowerCase().includes('does not exist')) {
          console.warn('Ticket analytics insert error:', error);
        }
      }
    } catch (err) {
      console.warn('Ticket analytics tracking failed:', err);
    }
  }, [seen]);

  const trackTicketView = useCallback((ticketId: string, eventId: string, userId: string) => {
    trackEvent({ event_type: 'ticket_view', ticket_id: ticketId, event_id: eventId, user_id: userId, metadata: { ts: Date.now(), source: 'tickets_page' } });
  }, [trackEvent]);

  const trackQRCodeView = useCallback((ticketId: string, eventId: string, userId: string) => {
    trackEvent({ event_type: 'qr_code_view', ticket_id: ticketId, event_id: eventId, user_id: userId, metadata: { ts: Date.now(), source: 'qr_modal' } });
  }, [trackEvent]);

  const trackTicketShare = useCallback((ticketId: string, eventId: string, userId: string, method: string) => {
    trackEvent({ event_type: 'ticket_share', ticket_id: ticketId, event_id: eventId, user_id: userId, metadata: { ts: Date.now(), share_method: method } });
  }, [trackEvent]);

  const trackTicketCopy = useCallback((ticketId: string, eventId: string, userId: string) => {
    trackEvent({ event_type: 'ticket_copy', ticket_id: ticketId, event_id: eventId, user_id: userId, metadata: { ts: Date.now(), source: 'qr_modal' } });
  }, [trackEvent]);

  const trackWalletDownload = useCallback((ticketId: string, eventId: string, userId: string) => {
    trackEvent({ event_type: 'wallet_download', ticket_id: ticketId, event_id: eventId, user_id: userId, metadata: { ts: Date.now(), source: 'tickets_page' } });
  }, [trackEvent]);

  return {
    trackTicketView,
    trackQRCodeView,
    trackTicketShare,
    trackTicketCopy,
    trackWalletDownload
  };
}

// Profile analytics hook unchanged except dedupe + optional insert pattern
export function useProfileAnalytics() {
  const seen = useDeduper();

  const trackEvent = useCallback(async (event: {
    event_type: 'profile_view' | 'role_toggle' | 'profile_edit' | 'profile_share';
    user_id: string;
    metadata?: Record<string, any>;
  }) => {
    const key = `${event.event_type}:${event.user_id}`;
    if (seen(key)) return;

    try {
      console.log('Profile Analytics Event:', event);
      // Optional server insert (swallow errors)
      const { error } = await supabase.from('profile_analytics').insert({
        type: event.event_type,
        user_id: event.user_id,
        metadata: event.metadata ?? {},
        created_at: new Date().toISOString()
      } as any);
      if (error) {
        if (!`${error.message}`.toLowerCase().includes('does not exist')) {
          console.warn('Profile analytics insert error:', error);
        }
      }
    } catch (err) {
      console.warn('Profile analytics tracking failed:', err);
    }
  }, [seen]);

  const trackProfileView = useCallback((userId: string) => {
    trackEvent({ event_type: 'profile_view', user_id: userId, metadata: { ts: Date.now(), source: 'profile_page' } });
  }, [trackEvent]);

  const trackRoleToggle = useCallback((userId: string, newRole: string) => {
    trackEvent({ event_type: 'role_toggle', user_id: userId, metadata: { ts: Date.now(), new_role: newRole, source: 'profile_page' } });
  }, [trackEvent]);

  const trackProfileEdit = useCallback((userId: string, field: string) => {
    trackEvent({ event_type: 'profile_edit', user_id: userId, metadata: { ts: Date.now(), edited_field: field, source: 'profile_page' } });
  }, [trackEvent]);

  const trackProfileShare = useCallback((userId: string, method: string) => {
    trackEvent({ event_type: 'profile_share', user_id: userId, metadata: { ts: Date.now(), share_method: method, source: 'profile_page' } });
  }, [trackEvent]);

  return {
    trackProfileView,
    trackRoleToggle,
    trackProfileEdit,
    trackProfileShare
  };
}
