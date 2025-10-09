import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TicketQrTokenState {
  token: string | null;
  expiresAt: Date | null;
  issuedAt: Date | null;
  isRefreshing: boolean;
  isError: boolean;
  errorMessage?: string;
  walletLinks?: {
    apple?: string;
    google?: string;
  };
}

interface UseTicketQrTokenOptions {
  ticketId: string;
  eventId: string;
  initialToken?: string | null;
  refreshWindowMs?: number;
}

type EdgeResponse = {
  token: string;
  expires_in?: number;
  expires_at?: string;
  issued_at?: string;
  wallet_links?: {
    apple?: string;
    google?: string;
  };
};

export function useTicketQrToken({
  ticketId,
  eventId,
  initialToken = null,
  refreshWindowMs = 5000,
}: UseTicketQrTokenOptions) {
  const { toast } = useToast();
  const [state, setState] = useState<TicketQrTokenState>({
    token: initialToken,
    expiresAt: null,
    issuedAt: null,
    isRefreshing: false,
    isError: false,
    walletLinks: undefined,
    errorMessage: undefined,
  });

  const refreshTimeout = useRef<number>();

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      token: initialToken ?? prev.token,
      isError: false,
      errorMessage: undefined,
    }));
  }, [initialToken]);

  const scheduleRefresh = useCallback((expiresAt: Date | null) => {
    const now = Date.now();
    if (!expiresAt) {
      window.clearTimeout(refreshTimeout.current);
      refreshTimeout.current = window.setTimeout(() => {
        void refresh();
      }, 25000);
      return;
    }
    const now = Date.now();
    const expiry = expiresAt.getTime();
    const refreshAt = Math.max(expiry - refreshWindowMs, now + 2000);
    const delay = refreshAt - now;
    if (delay <= 0) {
      void refresh();
      return;
    }
    window.clearTimeout(refreshTimeout.current);
    refreshTimeout.current = window.setTimeout(() => {
      void refresh();
    }, delay);
  }, [refreshWindowMs]);

  const refresh = useCallback(async () => {
    if (!ticketId || !eventId) return;
    if (!navigator.onLine) {
      setState((prev) => ({
        ...prev,
        isError: false,
        isRefreshing: false,
      }));
      return;
    }
    setState((prev) => ({ ...prev, isRefreshing: true, isError: false, errorMessage: undefined }));
    try {
      const { data, error } = await supabase.functions.invoke('issue-ticket-qr-token', {
        body: { ticket_id: ticketId, event_id: eventId },
      });

      if (error) throw new Error(error.message ?? 'Failed to refresh ticket token');

      const payload = (data ?? {}) as EdgeResponse;
      const expiresAt = payload.expires_at
        ? new Date(payload.expires_at)
        : payload.expires_in
          ? new Date(Date.now() + payload.expires_in * 1000)
          : null;
      const issuedAt = payload.issued_at ? new Date(payload.issued_at) : new Date();

      setState({
        token: payload.token,
        expiresAt,
        issuedAt,
        isRefreshing: false,
        isError: false,
        errorMessage: undefined,
        walletLinks: payload.wallet_links,
      });

      scheduleRefresh(expiresAt);
    } catch (err) {
      console.error('Failed to refresh QR token', err);
      const message = err instanceof Error ? err.message : 'Unable to refresh ticket code';
      if (navigator.onLine) {
        toast({
          title: 'QR refresh failed',
          description: message,
          variant: 'destructive',
        });
      }
      setState((prev) => ({
        ...prev,
        isRefreshing: false,
        isError: true,
        errorMessage: message,
      }));
    }
  }, [ticketId, eventId, refreshWindowMs, toast, scheduleRefresh]);

  useEffect(() => {
    if (!initialToken) {
      void refresh();
    }
    return () => {
      window.clearTimeout(refreshTimeout.current);
    };
    // we intentionally want to run once on mount or when ids change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, eventId, initialToken]);

  useEffect(() => {
    if (!state.expiresAt) return;
    scheduleRefresh(state.expiresAt);
  }, [state.expiresAt, scheduleRefresh]);

  const secondsRemaining = useMemo(() => {
    if (!state.expiresAt) return null;
    return Math.max(0, Math.round((state.expiresAt.getTime() - Date.now()) / 1000));
  }, [state.expiresAt]);

  return {
    ...state,
    secondsRemaining,
    refresh,
  };
}

