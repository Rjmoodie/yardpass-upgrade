import { supabase } from '@/integrations/supabase/client';

export async function createHold(params: { event_id: string; items: Record<string, number>; guest_code?: string | null }) {
  // Replace with your Edge Function / RPC call if available.
  const { data, error } = await supabase.functions.invoke('create-hold', { body: params });
  if (error) throw new Error(error.message ?? 'Failed to create hold');
  return data as { id: string; totals: { subtotal_cents: number; fees_cents: number; discount_cents: number; total_cents: number } };
}

export async function createCheckoutSession(params: { hold_id: string }) {
  const { data, error } = await supabase.functions.invoke('checkout', { body: params });
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
  const { data, error } = await supabase.functions.invoke('guest-checkout', { body: params });
  if (error) throw new Error(error.message ?? 'Failed to create guest checkout session');
  return data as { url: string };
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

