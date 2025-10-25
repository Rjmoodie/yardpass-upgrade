import { supabase } from '@/integrations/supabase/client';

export async function createHold(params: { event_id: string; items: Record<string, number>; guest_code?: string | null }) {
  const { data, error } = await supabase.functions.invoke('create-hold', { body: params });
  if (error) throw new Error(error.message ?? 'Failed to create hold');
  return data as { id: string; totals: { subtotal_cents: number; fees_cents: number; discount_cents: number; total_cents: number } };
}

export async function createCheckoutSession(params: { 
  hold_id: string; 
  eventId: string; 
  ticketSelections: { tierId: string; quantity: number }[] 
}) {
  const { data, error } = await supabase.functions.invoke('checkout', { 
    body: {
      hold_id: params.hold_id,
      eventId: params.eventId,
      ticketSelections: params.ticketSelections
    }
  });
  if (error) throw new Error(error.message ?? 'Failed to create checkout session');
  return data as { url: string };
}

export async function createGuestCheckoutSession(params: {
  event_id: string;
  items: { tier_id: string; quantity: number; unit_price_cents?: number }[];
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  guest_code?: string | null;
}) {
  try {
    // Use raw fetch to properly handle error responses with body
    const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    
    const response = await fetch(`${baseUrl}/functions/v1/guest-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify(params)
    });
    
    const responseData = await response.json();
    console.log('[createGuestCheckoutSession] Response:', { status: response.status, data: responseData });
    
            // Check if this is a "user exists" error (409 Conflict)
            if (response.status === 409 || responseData?.error_code === 'user_exists' || responseData?.should_sign_in) {
              const err: any = new Error(responseData.error || 'An account with this email already exists. Please sign in to continue.');
              err.shouldSignIn = true;
              throw err;
            }
            
            // Check if event has ended (410 Gone)
            if (response.status === 410 || responseData?.error_code === 'EVENT_ENDED') {
              const err: any = new Error(responseData.error || 'This event has already ended.');
              err.isEventEnded = true;
              throw err;
            }
            
            // Check for other errors
            if (!response.ok) {
              throw new Error(responseData.error || 'Failed to create guest checkout session');
            }
    
    // Validate we have a session URL
    if (!responseData?.url && !responseData?.session_url) {
      throw new Error('No checkout URL received from server');
    }
    
    return responseData as { url: string };
  } catch (err: any) {
    console.error('[createGuestCheckoutSession] Unexpected error:', err);
    
    // Re-throw if it's a "should sign in" error
    if (err.shouldSignIn) {
      throw err;
    }
    
    // Fallback: redirect to regular checkout with a message
    throw new Error('Guest checkout is temporarily unavailable. Please create an account to purchase tickets.');
  }
}

export async function fetchTicketTiers(eventId: string) {
  const { data, error } = await supabase
    .from('ticket_tiers')
    .select('*')
    .eq('event_id', eventId)
    .in('status', ['active', 'sold_out'])
    .order('sort_index', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchOrderStatus(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  return (data?.status ?? 'pending') as 'pending'|'completed'|'failed';
}

export async function validateTicket(payload: { qr: string; event_id: string }, opts?: { signal?: AbortSignal }) {
  const { data, error } = await supabase.functions.invoke('scanner-validate', { body: { qr_token: payload.qr, event_id: payload.event_id } });
  if (error) {
    if ((opts?.signal as any)?.aborted) throw new DOMException('Aborted', 'AbortError');
    throw new Error(error.message ?? 'Validation failed');
  }
  return data as { 
    success: boolean; 
    result: 'valid'|'duplicate'|'invalid'|'expired'|'wrong_event'|'refunded'|'void'; 
    message?: string;
    ticket?: { id: string; tier_name: string; attendee_name: string; badge_label?: string };
    timestamp?: string;
  };
}

