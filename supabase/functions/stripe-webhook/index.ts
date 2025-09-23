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

      // Note: Ticket creation is handled by process-payment function
      // This webhook only marks the order as paid to trigger the process-payment flow
      logStep("Order marked as paid, process-payment will handle ticket creation");

      logStep("Payment processed successfully", { 
        orderId: order.id
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

    } else if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      logStep("Processing account.updated", { accountId: account.id });

      // Update payout account status
      const { error: updateError } = await supabaseService
        .from("payout_accounts")
        .update({
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted
        })
        .eq("stripe_connect_id", account.id);

      if (updateError) {
        logStep("Failed to update payout account", { error: updateError.message });
      } else {
        logStep("Payout account updated successfully", { 
          accountId: account.id,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted
        });
      }

    } else if (event.type === "payout.paid") {
      const payout = event.data.object as Stripe.Payout;
      logStep("Processing payout.paid", { payoutId: payout.id, amount: payout.amount });

      // Log successful payout (you can extend this to update your payouts table)
      // For now, just log it
      logStep("Payout completed successfully", {
        payoutId: payout.id,
        amount: payout.amount,
        destination: payout.destination
      });

    } else if (event.type === "payout.failed") {
      const payout = event.data.object as Stripe.Payout;
      logStep("Processing payout.failed", { payoutId: payout.id, failureCode: payout.failure_code });

      // Log failed payout
      logStep("Payout failed", {
        payoutId: payout.id,
        amount: payout.amount,
        failureCode: payout.failure_code,
        failureMessage: payout.failure_message
      });

    } else if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.order_id;

      if (orderId) {
        logStep("Processing sponsorship payment success", { orderId, paymentIntentId: paymentIntent.id });
        
        // Update sponsorship order to escrow status
        const { error: updateError } = await supabaseService
          .from("sponsorship_orders")
          .update({ 
            status: "escrow", 
            stripe_payment_intent_id: paymentIntent.id,
            updated_at: new Date().toISOString() 
          })
          .eq("id", orderId);

        if (updateError) {
          logStep("Failed to update sponsorship order", { error: updateError.message });
        } else {
          logStep("Sponsorship order moved to escrow", { orderId });
        }
      }

    } else {
      logStep("Unhandled webhook event", { type: event.type });
    }

    return createResponse({ received: true });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return createErrorResponse(errorMessage);
  }
});
