import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Unified analytics row stored in public.analytics_events
 */
type AnalyticsRow = {
  created_at?: string;
  user_id: string | null;
  event_type:
    | 'ticket_view'
    | 'qr_code_view'
    | 'ticket_share'
    | 'ticket_copy'
    | 'wallet_download'
    | 'profile_view'
    | 'role_toggle'
    | 'profile_edit'
    | 'profile_share';
  event_id?: string | null;
  ticket_id?: string | null;
  source?: string | null;
  metadata?: Record<string, any>;
};

const QUEUE_KEY = 'analytics_queue_v1';

function getQueue(): AnalyticsRow[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as AnalyticsRow[]) : [];
  } catch {
    return [];
  }
}
function setQueue(items: AnalyticsRow[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function useTicketAnalytics() {
  const flushingRef = useRef(false);

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    const queue = getQueue();
    if (!queue.length) return;

    // Only try online
    if (!navigator.onLine) return;

    try {
      flushingRef.current = true;
      const { error } = await supabase.from('analytics.analytics_events').insert(queue);
      if (!error) {
        setQueue([]);
      } else {
        // keep queue; try later
        // console.error('flush analytics failed', error);
      }
    } catch {
      // keep queue for later
    } finally {
      flushingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Flush on mount + when regaining connectivity
    flushQueue();
    const online = () => flushQueue();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [flushQueue]);

  const enqueueOrSend = useCallback(async (row: AnalyticsRow) => {
    const payload: AnalyticsRow = {
      ...row,
      created_at: new Date().toISOString(),
      metadata: row.metadata ?? {},
    };

    // If offline, queue and bail
    if (!navigator.onLine) {
      const q = getQueue();
      q.push(payload);
      setQueue(q);
      return;
    }

    // Try immediate insert
    const { error } = await supabase.from('analytics.analytics_events').insert(payload);
    if (error) {
      // fall back to queue
      const q = getQueue();
      q.push(payload);
      setQueue(q);
    }
  }, []);

  // Public API — identical signatures to your existing code
  const trackTicketView = useCallback(
    (ticketId: string, eventId: string, userId: string) => {
      enqueueOrSend({
        user_id: userId || null,
        event_type: 'ticket_view',
        event_id: eventId,
        ticket_id: ticketId,
        source: 'tickets_page',
        metadata: { ts: Date.now() },
      });
    },
    [enqueueOrSend]
  );

  const trackQRCodeView = useCallback(
    (ticketId: string, eventId: string, userId: string) => {
      enqueueOrSend({
        user_id: userId || null,
        event_type: 'qr_code_view',
        event_id: eventId,
        ticket_id: ticketId,
        source: 'qr_modal',
        metadata: { ts: Date.now() },
      });
    },
    [enqueueOrSend]
  );

  const trackTicketShare = useCallback(
    (ticketId: string, eventId: string, userId: string, method: string) => {
      enqueueOrSend({
        user_id: userId || null,
        event_type: 'ticket_share',
        event_id: eventId,
        ticket_id: ticketId,
        source: 'tickets_page',
        metadata: { ts: Date.now(), method },
      });
    },
    [enqueueOrSend]
  );

  const trackTicketCopy = useCallback(
    (ticketId: string, eventId: string, userId: string) => {
      enqueueOrSend({
        user_id: userId || null,
        event_type: 'ticket_copy',
        event_id: eventId,
        ticket_id: ticketId,
        source: 'qr_modal',
        metadata: { ts: Date.now() },
      });
    },
    [enqueueOrSend]
  );

  const trackWalletDownload = useCallback(
    (ticketId: string, eventId: string, userId: string) => {
      enqueueOrSend({
        user_id: userId || null,
        event_type: 'wallet_download',
        event_id: eventId,
        ticket_id: ticketId,
        source: 'tickets_page',
        metadata: { ts: Date.now() },
      });
    },
    [enqueueOrSend]
  );

  return {
    trackTicketView,
    trackQRCodeView,
    trackTicketShare,
    trackTicketCopy,
    trackWalletDownload,
  };
}

/** Profile analytics reuse the same table + queue */
export function useProfileAnalytics() {
  const flushingRef = useRef(false);

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    const queue = getQueue();
    if (!queue.length || !navigator.onLine) return;
    try {
      flushingRef.current = true;
      const { error } = await supabase.from('analytics.analytics_events').insert(queue);
      if (!error) setQueue([]);
    } catch {
      // keep queue
    } finally {
      flushingRef.current = false;
    }
  }, []);

  useEffect(() => {
    flushQueue();
    const online = () => flushQueue();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [flushQueue]);

  const enqueueOrSend = useCallback(async (row: AnalyticsRow) => {
    const payload: AnalyticsRow = {
      ...row,
      created_at: new Date().toISOString(),
      metadata: row.metadata ?? {},
    };

    if (!navigator.onLine) {
      const q = getQueue();
      q.push(payload);
      setQueue(q);
      return;
    }

    const { error } = await supabase.from('analytics.analytics_events').insert(payload);
    if (error) {
      const q = getQueue();
      q.push(payload);
      setQueue(q);
    }
  }, []);

  const trackProfileView = useCallback((userId: string) => {
    enqueueOrSend({
      user_id: userId || null,
      event_type: 'profile_view',
      source: 'profile_page',
      metadata: { ts: Date.now() },
    });
  }, [enqueueOrSend]);

  const trackRoleToggle = useCallback((userId: string, newRole: string) => {
    enqueueOrSend({
      user_id: userId || null,
      event_type: 'role_toggle',
      source: 'profile_page',
      metadata: { ts: Date.now(), new_role: newRole },
    });
  }, [enqueueOrSend]);

  const trackProfileEdit = useCallback((userId: string, field: string) => {
    enqueueOrSend({
      user_id: userId || null,
      event_type: 'profile_edit',
      source: 'profile_page',
      metadata: { ts: Date.now(), field },
    });
  }, [enqueueOrSend]);

  const trackProfileShare = useCallback((userId: string, method: string) => {
    enqueueOrSend({
      user_id: userId || null,
      event_type: 'profile_share',
      source: 'profile_page',
      metadata: { ts: Date.now(), method },
    });
  }, [enqueueOrSend]);

  return {
    trackProfileView,
    trackRoleToggle,
    trackProfileEdit,
    trackProfileShare,
  };
}
