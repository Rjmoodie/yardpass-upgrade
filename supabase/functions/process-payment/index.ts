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
      throw new Error("Order not found");
    }

    logStep("Order found", { orderId: order.id, status: order.status });

    // If already paid, return success
    if (order.status === 'paid') {
      const { data: tickets } = await supabaseService
        .from("tickets")
        .select("id")
        .eq("order_id", order.id);

      return createResponse({
        order: {
          id: order.id,
          event_title: order.events?.title || "Event",
          tickets_count: tickets?.length || 0,
          total_amount: order.total_cents / 100,
          status: 'paid'
        }
      });
    }

    // Mark order as paid and create tickets
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

    // Create tickets based on order items
    const { data: orderItems, error: itemsError } = await supabaseService
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    if (itemsError) {
      logStep("Failed to fetch order items", { error: itemsError.message });
      throw new Error("Failed to fetch order items");
    }

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

    logStep("Payment processed successfully", { 
      orderId: order.id, 
      ticketsCreated: ticketsToCreate.length 
    });

    return createResponse({
      order: {
        id: order.id,
        event_title: order.events?.title || "Event",
        tickets_count: ticketsToCreate.length,
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