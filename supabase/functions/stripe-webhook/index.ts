import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      throw new Error("Missing Stripe configuration");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err.message });
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Create Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Processing checkout.session.completed", { sessionId: session.id });

      // Find the order by session ID
      const { data: order, error: orderError } = await supabaseService
        .from("orders")
        .select(`
          *,
          events (
            title
          )
        `)
        .eq("stripe_session_id", session.id)
        .single();

      if (orderError) {
        logStep("Order not found", { error: orderError.message });
        throw new Error("Order not found");
      }

      logStep("Order found", { orderId: order.id, status: order.status });

      // If already processed, skip
      if (order.status === 'paid') {
        logStep("Order already processed", { orderId: order.id });
        return createResponse({ received: true });
      }

      // Mark order as paid
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

      // Update ticket tier quantities
      for (const item of orderItems || []) {
        const { error: tierError } = await supabaseService
          .from("ticket_tiers")
          .update({
            quantity: supabaseService.raw(`quantity - ${item.quantity}`)
          })
          .eq("id", item.tier_id);

        if (tierError) {
          logStep("Failed to update tier quantity", { error: tierError.message });
          // Don't throw here, tickets are already created
        }
      }

      logStep("Payment processed successfully", { 
        orderId: order.id, 
        ticketsCreated: ticketsToCreate.length 
      });

    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Processing checkout.session.expired", { sessionId: session.id });

      // Find the order and release reserved tickets
      const { data: order, error: orderError } = await supabaseService
        .from("orders")
        .select(`
          *,
          order_items (
            tier_id,
            quantity
          )
        `)
        .eq("stripe_session_id", session.id)
        .single();

      if (orderError) {
        logStep("Order not found for expired session", { error: orderError.message });
      } else {
        // Release reserved tickets
        for (const item of order.order_items || []) {
          const { error: releaseError } = await supabaseService
            .from("ticket_tiers")
            .update({
              quantity: supabaseService.raw(`quantity + ${item.quantity}`)
            })
            .eq("id", item.tier_id);

          if (releaseError) {
            logStep("Failed to release tickets", { tierId: item.tier_id, error: releaseError.message });
          }
        }

        // Mark order as cancelled
        const { error: updateError } = await supabaseService
          .from("orders")
          .update({
            status: 'cancelled'
          })
          .eq("id", order.id);

        if (updateError) {
          logStep("Failed to update expired order", { error: updateError.message });
        }
      }

    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      logStep("Processing payment_intent.payment_failed", { paymentIntentId: paymentIntent.id });

      // Find order by metadata and mark as failed
      const { error: updateError } = await supabaseService
        .from("orders")
        .update({
          status: 'failed'
        })
        .eq("stripe_session_id", paymentIntent.metadata?.session_id);

      if (updateError) {
        logStep("Failed to update failed order", { error: updateError.message });
      }
    }

    return createResponse({ received: true });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return createErrorResponse(errorMessage);
  }
});
