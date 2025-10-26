import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Log immediately - this should always show up
  console.log("=== WEBHOOK CALLED ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  
  try {
    logStep("Webhook received", { method: req.method });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      logStep("Missing Stripe configuration");
      throw new Error("Missing Stripe configuration");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      logStep("No Stripe signature found");
      throw new Error("No Stripe signature found");
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Event verified successfully", { type: event.type, id: event.id });
    } catch (err: any) {
      logStep("Webhook signature verification failed", { error: err.message });
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    // Create Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Processing checkout.session.completed", { sessionId: session.id });

      // Skip wallet/credit purchases - those are handled by wallet-stripe-webhook
      const metadata = session.metadata || {};
      if (metadata.org_wallet_id || metadata.wallet_id || metadata.invoice_id) {
        logStep("Skipping wallet purchase (handled by wallet-stripe-webhook)", { 
          sessionId: session.id,
          hasOrgWallet: !!metadata.org_wallet_id,
          hasWallet: !!metadata.wallet_id,
          hasInvoice: !!metadata.invoice_id
        });
        return new Response(JSON.stringify({ received: true, skipped: "wallet_purchase" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Find the order by session ID
      const { data: order, error: orderError } = await supabaseService
        .from("orders")
        .select(`
          *,
          events!orders_event_id_fkey (
            title
          )
        `)
        .eq("stripe_session_id", session.id)
        .maybeSingle();

      if (orderError) {
        logStep("Database error finding order", { 
          sessionId: session.id,
          error: orderError.message,
          code: orderError.code 
        });
        throw new Error(`Database error: ${orderError.message}`);
      }

      if (!order) {
        logStep("Order not found for session", { sessionId: session.id });
        throw new Error(`Order not found for session: ${session.id}`);
      }

      logStep("Order found", { orderId: order.id, status: order.status });

      // If already processed, skip
      if (order.status === 'paid') {
        logStep("Order already processed", { orderId: order.id });
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Call process-payment to handle ticket creation and email sending
      logStep("Calling process-payment function", { sessionId: session.id });
      
      const processPaymentResponse = await supabaseService.functions.invoke('process-payment', {
        body: { sessionId: session.id }
      });

      if (processPaymentResponse.error) {
        logStep("process-payment failed", { error: processPaymentResponse.error });
        // Mark as paid anyway so user can manually retry
        await supabaseService
          .from("orders")
          .update({
            status: 'paid',
            paid_at: new Date().toISOString()
          })
          .eq("id", order.id);
      } else {
        logStep("process-payment succeeded", { 
          orderId: order.id,
          ticketsCreated: processPaymentResponse.data?.order?.tickets_count
        });
      }

      logStep("Payment processed successfully", { orderId: order.id });

    } else {
      logStep("Unhandled webhook event", { type: event.type });
    }

    logStep("Webhook processed successfully", { type: event.type });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});