import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TicketQrTokenState {
  token: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
}

interface UseTicketQrTokenOptions {
  ticketId: string;
  eventId: string;
}

export function useTicketQrToken({
  ticketId,
  eventId,
}: UseTicketQrTokenOptions) {
  const [state, setState] = useState<TicketQrTokenState>({
    token: null,
    isLoading: true,
    isError: false,
    errorMessage: undefined,
  });

  useEffect(() => {
    async function fetchStaticQrCode() {
      if (!ticketId) {
        setState({
          token: null,
          isLoading: false,
          isError: true,
          errorMessage: 'No ticket ID provided',
        });
        return;
      }

      try {
        setState((prev) => ({ ...prev, isLoading: true, isError: false }));

        const { data: ticket, error } = await supabase
          .from('tickets')
          .select('qr_code')
          .eq('id', ticketId)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        if (!ticket?.qr_code) {
          throw new Error('QR code not found for this ticket');
        }

        setState({
          token: ticket.qr_code,
          isLoading: false,
          isError: false,
          errorMessage: undefined,
        });
      } catch (err) {
        console.error('Failed to fetch QR code', err);
        const message = err instanceof Error ? err.message : 'Unable to load ticket code';
        setState({
          token: null,
          isLoading: false,
          isError: true,
          errorMessage: message,
        });
      }
    }

    fetchStaticQrCode();
  }, [ticketId]);

  return state;
}

