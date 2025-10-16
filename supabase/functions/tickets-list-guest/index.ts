import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors, createResponse, createErrorResponse } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { token } = await req.json();

    if (!token) {
      return createErrorResponse('Missing token', 400);
    }

    // Hash the token to look up session
    const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
      .then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Verify session
    const { data: session, error: sessionError } = await supabase
      .from('guest_ticket_sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    // Build ticket query based on scope
    let query = supabase
      .from('tickets_enhanced')
      .select('*')
      .in('status', ['issued', 'transferred', 'redeemed']);

    // Apply contact filters
    if (session.method === 'email') {
      query = query.eq('owner_email', session.contact);
    } else if (session.method === 'phone') {
      query = query.eq('owner_phone', session.contact);
    }

    // Apply scope filters
    if (session.scope?.eventIds && session.scope.eventIds.length > 0) {
      query = query.in('event_id', session.scope.eventIds);
    }

    const { data: tickets, error: ticketsError } = await query;

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError);
      return createErrorResponse('Error fetching tickets', 500);
    }

    // Return tickets in flat structure matching the database view
    const transformedTickets = (tickets || []).map(ticket => ({
      id: ticket.id,
      event_id: ticket.event_id,
      tier_id: ticket.tier_id,
      order_id: ticket.order_id,
      status: ticket.status,
      qr_code: ticket.qr_code,
      wallet_pass_url: ticket.wallet_pass_url,
      created_at: ticket.created_at,
      redeemed_at: ticket.redeemed_at,
      owner_email: ticket.owner_email,
      owner_name: ticket.owner_name,
      owner_phone: ticket.owner_phone,
      // Event fields (flat structure)
      event_title: ticket.event_title,
      event_date: ticket.event_date,
      event_time: ticket.event_time,
      event_location: ticket.event_location,
      organizer_name: ticket.organizer_name,
      cover_image: ticket.cover_image,
      // Tier fields (flat structure)
      ticket_type: ticket.ticket_type,
      badge: ticket.badge,
      price: ticket.price,
      // Order fields (flat structure)
      order_date: ticket.order_date
    }));

    return createResponse({ 
      tickets: transformedTickets,
      session_info: {
        method: session.method,
        contact: session.contact,
        scope: session.scope
      }
    });

  } catch (error) {
    console.error('Error in tickets-list-guest:', error);
    return createErrorResponse('Internal server error', 500);
  }
})