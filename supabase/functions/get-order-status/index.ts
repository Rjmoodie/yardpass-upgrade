import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-ORDER-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    logStep("Function started");

    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');
    
    if (!sessionId) {
      throw new Error("session_id parameter is required");
    }
    logStep("Session ID found", { sessionId });

    // Create Supabase service client (no auth required for order lookup)
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Find the order by session ID
    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .select(`
        *,
        events (
          title
        )
      `)
      .eq("stripe_session_id", sessionId)
      .single();

    if (orderError) {
      logStep("Order not found", { error: orderError.message });
      return createResponse({ 
        status: 'not_found',
        message: 'Order not found'
      });
    }

    logStep("Order found", { orderId: order.id, status: order.status });

    // Get ticket count for this order
    const { data: tickets, error: ticketsError } = await supabaseService
      .from("tickets")
      .select("id")
      .eq("order_id", order.id);

    const ticketCount = tickets?.length || 0;
    logStep("Ticket count", { ticketCount });

    return createResponse({
      status: order.status,
      order_id: order.id,
      event_title: order.events?.title || "Event",
      tickets_count: ticketCount,
      total_amount: order.total_cents / 100,
      paid_at: order.paid_at
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in get-order-status", { message: errorMessage });
    return createErrorResponse(errorMessage);
  }
});