import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-USER-TICKETS] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    logStep("Function started");

    // Create Supabase client using the anon key for user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Fetch user's tickets with event and tier details - simplified query
    const { data: tickets, error: ticketsError } = await supabaseClient
      .from('tickets')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });

    if (ticketsError) {
      logStep("Simple tickets fetch failed", { error: ticketsError.message });
      throw new Error(`Tickets fetch failed: ${ticketsError.message}`);
    }

    // If no tickets, return empty result
    if (!tickets || tickets.length === 0) {
      logStep("No tickets found for user");
      return createResponse({ 
        tickets: [],
        count: 0
      });
    }

    // Fetch related data separately to avoid relationship issues
    const eventIds = [...new Set(tickets.map(t => t.event_id))];
    const tierIds = [...new Set(tickets.map(t => t.tier_id))];
    const orderIds = [...new Set(tickets.map(t => t.order_id).filter(Boolean))];

    const [eventsResult, tiersResult, ordersResult] = await Promise.all([
      supabaseClient.from('events').select('id, title, start_at, end_at, venue, city, address, cover_image_url').in('id', eventIds),
      supabaseClient.from('ticket_tiers').select('id, name, badge_label, price_cents').in('id', tierIds),
      orderIds.length > 0 ? supabaseClient.from('orders').select('id, total_cents, created_at').in('id', orderIds) : { data: [], error: null }
    ]);

    // Create lookup maps
    const eventsMap = new Map((eventsResult.data || []).map(e => [e.id, e]));
    const tiersMap = new Map((tiersResult.data || []).map(t => [t.id, t]));
    const ordersMap = new Map((ordersResult.data || []).map(o => [o.id, o]));

    // Combine data
    const enrichedTickets = tickets.map(ticket => ({
      ...ticket,
      events: eventsMap.get(ticket.event_id) || null,
      ticket_tiers: tiersMap.get(ticket.tier_id) || null,
      orders: ticket.order_id ? ordersMap.get(ticket.order_id) || null : null
    }));

    logStep("Tickets enriched", { count: enrichedTickets.length });

    return createResponse({ 
      tickets: enrichedTickets,
      count: enrichedTickets.length
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in get-user-tickets", { message: errorMessage });
    return createErrorResponse(errorMessage);
  }
});