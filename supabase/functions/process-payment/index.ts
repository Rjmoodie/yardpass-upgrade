import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

interface ProcessPaymentRequest {
  sessionId: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-PAYMENT] ${step}${detailsStr}`);
};

const generateQRCode = (ticketId: string): string => {
  // Generate a simple QR code identifier
  return `YARD_${ticketId.replace(/-/g, '').toUpperCase().slice(0, 12)}`;
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Create Supabase service client (bypass RLS)
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { sessionId }: ProcessPaymentRequest = await req.json();
    logStep("Request data parsed", { sessionId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Session retrieved", { status: session.payment_status });

    if (session.payment_status !== 'paid') {
      throw new Error(`Payment not completed. Status: ${session.payment_status}`);
    }

    // Find the order
    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .select("*")
      .eq("stripe_session_id", sessionId)
      .single();

    if (orderError) throw new Error(`Order not found: ${orderError.message}`);
    logStep("Order found", { orderId: order.id, status: order.status });

    // Skip if already processed
    if (order.status === 'paid') {
      logStep("Order already processed");
      return createResponse({ 
        success: true, 
        message: "Order already processed" 
      });
    }

    // Update order status
    const { error: updateOrderError } = await supabaseService
      .from("orders")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: session.payment_intent
      })
      .eq("id", order.id);

    if (updateOrderError) throw new Error(`Order update failed: ${updateOrderError.message}`);
    logStep("Order updated to paid");

    // Get order items
    const { data: orderItems, error: itemsError } = await supabaseService
      .from("order_items")
      .select(`
        *,
        ticket_tiers (
          id,
          name,
          badge_label,
          event_id
        )
      `)
      .eq("order_id", order.id);

    if (itemsError) throw new Error(`Order items not found: ${itemsError.message}`);
    logStep("Order items found", { count: orderItems.length });

    // Create tickets
    const tickets = [];
    for (const item of orderItems) {
      for (let i = 0; i < item.quantity; i++) {
        const ticketId = crypto.randomUUID();
        const qrCode = generateQRCode(ticketId);
        
        tickets.push({
          id: ticketId,
          event_id: item.ticket_tiers.event_id,
          tier_id: item.tier_id,
          owner_user_id: order.user_id,
          order_id: order.id,
          qr_code: qrCode,
          status: "issued"
        });
      }
    }

    const { error: ticketsError } = await supabaseService
      .from("tickets")
      .insert(tickets);

    if (ticketsError) throw new Error(`Tickets creation failed: ${ticketsError.message}`);
    logStep("Tickets created", { count: tickets.length });

    // Get event details for confirmation
    const { data: event, error: eventError } = await supabaseService
      .from("events")
      .select("title")
      .eq("id", orderItems[0].ticket_tiers.event_id)
      .single();

    if (eventError) {
      logStep("Could not fetch event details", { error: eventError.message });
    }

    return createResponse({
      success: true,
      order: {
        id: order.id,
        event_title: event?.title || "Event",
        tickets_count: tickets.length,
        total_amount: order.total_cents / 100
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-payment", { message: errorMessage });
    return createErrorResponse(errorMessage);
  }
});