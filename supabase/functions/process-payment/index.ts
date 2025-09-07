import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    logStep("Function started");

    const { sessionId } = await req.json();
    if (!sessionId) {
      throw new Error("sessionId is required");
    }
    logStep("Session ID provided", { sessionId });

    // Create Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Find the order by session ID with better error handling
    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .select(`
        *,
        events (
          title,
          start_at,
          venue,
          city
        )
      `)
      .eq("stripe_session_id", sessionId)
      .maybeSingle(); // Use maybeSingle instead of single for better error handling

    if (orderError) {
      logStep("Database error finding order", { error: orderError.message });
      throw new Error(`Database error: ${orderError.message}`);
    }

    if (!order) {
      logStep("Order not found", { sessionId });
      throw new Error("Order not found for this session");
    }

    logStep("Order found", { orderId: order.id, status: order.status });

    // If already paid, return success immediately
    if (order.status === 'paid') {
      const { data: tickets } = await supabaseService
        .from("tickets")
        .select("id")
        .eq("order_id", order.id);

      logStep("Order already paid, returning existing data", { ticketCount: tickets?.length || 0 });

      return createResponse({
        order: {
          id: order.id,
          event_title: order.events?.title || "Event",
          event_start_at: order.events?.start_at,
          event_venue: order.events?.venue,
          event_city: order.events?.city,
          tickets_count: tickets?.length || 0,
          total_amount: order.total_cents / 100,
          status: 'paid'
        }
      });
    }

    // Start background ticket creation immediately
    const ticketCreationPromise = (async () => {
      // Get order items
      const { data: orderItems, error: itemsError } = await supabaseService
        .from("order_items")
        .select("*")
        .eq("order_id", order.id);

      if (itemsError) {
        logStep("Failed to fetch order items", { error: itemsError.message });
        throw new Error("Failed to fetch order items");
      }

      // Create tickets
      const ticketsToCreate = [];
      for (const item of orderItems || []) {
        for (let i = 0; i < item.quantity; i++) {
          ticketsToCreate.push({
            event_id: order.event_id,
            tier_id: item.tier_id,
            order_id: order.id,
            owner_user_id: order.user_id,
            qr_code: `ticket_${order.id}_${item.tier_id}_${Date.now()}_${i}`,
            status: 'issued'
          });
        }
      }

      const { error: ticketsError } = await supabaseService
        .from("tickets")
        .insert(ticketsToCreate);

      if (ticketsError) {
        logStep("Failed to create tickets", { error: ticketsError.message });
        throw new Error("Failed to create tickets");
      }

      logStep("Tickets created successfully", { count: ticketsToCreate.length });
      return ticketsToCreate.length;
    })();

    // Mark order as paid first
    const { error: updateError } = await supabaseService
      .from("orders")
      .update({
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq("id", order.id);

    if (updateError) {
      logStep("Failed to update order", { error: updateError.message });
      throw new Error("Failed to update order status");
    }

    logStep("Order marked as paid");

    // Wait for tickets to be created
    const ticketCount = await ticketCreationPromise;

    logStep("Payment processed successfully", { 
      orderId: order.id, 
      ticketsCreated: ticketCount 
    });

    return createResponse({
      order: {
        id: order.id,
        event_title: order.events?.title || "Event",
        event_start_at: order.events?.start_at,
        event_venue: order.events?.venue,
        event_city: order.events?.city,
        tickets_count: ticketCount,
        total_amount: order.total_cents / 100,
        status: 'paid'
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-payment", { message: errorMessage });
    return createErrorResponse(errorMessage);
  }
});