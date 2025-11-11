import { supabase } from '@/integrations/supabase/client';

//
// Shared types
//

export type ScanResultType =
  | 'valid'
  | 'duplicate'
  | 'invalid'
  | 'expired'
  | 'wrong_event'
  | 'refunded'
  | 'void';

type HoldResponse = {
  id: string;
  totals: {
    subtotal_cents: number;
    fees_cents: number;
    discount_cents: number;
    total_cents: number;
  };
};

type CheckoutSessionResponse = {
  url: string;
};

export type TicketValidationResponse = {
  success: boolean;
  result: ScanResultType;
  message?: string;
  ticket?: {
    id: string;
    tier_name: string;
    attendee_name: string;
    badge_label?: string;
  };
  timestamp?: string;
};

export type GuestCheckoutResponse = {
  url?: string;
  session_url?: string;
  client_secret?: string;
  error?: string;
  error_code?: string;
  [key: string]: unknown;
};

export type OrderStatus = 'pending' | 'completed' | 'failed';

//
// Shared helper for Supabase edge functions
//

export class ApiError extends Error {
  code?: string;
  status?: number;
  details?: unknown;
  isEventEnded?: boolean;
  shouldSignIn?: boolean;

  constructor(message: string, init?: Partial<ApiError>) {
    super(message);
    Object.assign(this, init);
    this.name = 'ApiError';
  }
}

async function callFunction<T>(
  name: string,
  body: unknown
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, {
    body,
  });

  if (error) {
    throw new ApiError(error.message ?? `Failed to call function: ${name}`, {
      status: (error as any).status,
      details: error,
      code: (error as any).code,
    });
  }

  if (!data) {
    throw new ApiError(`No data returned from function: ${name}`);
  }

  return data;
}

//
// Public helpers
//

export async function createHold(params: {
  event_id: string;
  items: Record<string, number>;
  guest_code?: string | null;
}): Promise<HoldResponse> {
  return await callFunction<HoldResponse>('create-hold', params);
}

export async function createCheckoutSession(params: {
  hold_id: string;
  eventId: string;
  ticketSelections: { tierId: string; quantity: number }[];
}): Promise<CheckoutSessionResponse> {
  // translate to the payload your edge function expects
  return await callFunction<CheckoutSessionResponse>('checkout', {
    hold_id: params.hold_id,
    eventId: params.eventId,
    ticketSelections: params.ticketSelections,
  });
}

export async function createGuestCheckoutSession(params: {
  event_id: string;
  items: { tier_id: string; quantity: number; unit_price_cents?: number }[];
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  guest_code?: string | null;
  city?: string;
  country?: string;
}): Promise<GuestCheckoutResponse> {
  try {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

    if (!baseUrl || !anonKey) {
      throw new ApiError('Supabase environment variables are not configured', {
        code: 'CONFIG_ERROR',
      });
    }

    const response = await fetch(`${baseUrl}/functions/v1/guest-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(params),
    });

    const responseData: GuestCheckoutResponse = await response.json().catch(() => ({} as any));

    console.log('[createGuestCheckoutSession] Response:', {
      status: response.status,
      data: responseData,
    });

    // User already exists → let the function decide what to do,
    // but don't block the client on 409 alone.
    if (response.status === 409 || responseData?.error_code === 'user_exists') {
      console.log('[createGuestCheckoutSession] User exists, but continuing with checkout...');
      // no early throw – we still check for checkout data below
    }

    // Event has ended
    if (response.status === 410 || responseData?.error_code === 'EVENT_ENDED') {
      throw new ApiError(responseData.error || 'This event has already ended.', {
        isEventEnded: true,
        status: 410,
        code: 'EVENT_ENDED',
        details: responseData,
      });
    }

    // Any other non-OK response
    if (!response.ok) {
      throw new ApiError(
        responseData.error || 'Failed to create guest checkout session',
        {
          status: response.status,
          code: responseData.error_code,
          details: responseData,
        }
      );
    }

    // Ensure we have some kind of checkout info
    if (
      !responseData?.client_secret &&
      !responseData?.url &&
      !responseData?.session_url
    ) {
      throw new ApiError('No checkout data received from server', {
        code: 'NO_CHECKOUT_DATA',
        details: responseData,
      });
    }

    return responseData;
  } catch (err: any) {
    console.error('[createGuestCheckoutSession] Unexpected error:', err);

    // Preserve structured / intentional errors
    if (err instanceof ApiError) {
      // let caller decide what to do with isEventEnded, shouldSignIn, etc.
      throw err;
    }

    if (err?.shouldSignIn) {
      throw err;
    }

    // Fallback generic error
    throw new ApiError(
      'Guest checkout is temporarily unavailable. Please create an account to purchase tickets.',
      {
        code: 'GUEST_CHECKOUT_UNAVAILABLE',
        details: err,
      }
    );
  }
}

export async function fetchTicketTiers(eventId: string) {
  const { data, error } = await supabase
    .from('ticket_tiers')
    .select('*') // consider selecting explicit columns for perf
    .eq('event_id', eventId)
    .in('status', ['active', 'sold_out'])
    .order('sort_index', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchOrderStatus(orderId: string): Promise<OrderStatus> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw error;

  // If the DB ever gets new statuses, this will still compile,
  // but you can map/validate here if needed.
  return (data?.status ?? 'pending') as OrderStatus;
}

export async function validateTicket(
  payload: { qr: string; event_id: string },
  opts?: { signal?: AbortSignal }
): Promise<TicketValidationResponse> {
  try {
    // Note: Supabase client doesn't support AbortSignal in functions.invoke yet
    // If you need cancellation, consider using raw fetch instead
    return await callFunction<TicketValidationResponse>(
      'scanner-validate',
      { qr_token: payload.qr, event_id: payload.event_id }
    );
  } catch (err: any) {
    // Preserve abort semantics for callers if signal was passed
    if (opts?.signal?.aborted || err?.name === 'AbortError') {
      throw new DOMException('Aborted', 'AbortError');
    }
    throw err;
  }
}
