import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

interface CheckoutRequest {
  eventId: string;
  ticketSelections: {
    tierId: string;
    quantity: number;
  }[];
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

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
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { eventId, ticketSelections }: CheckoutRequest = await req.json();
    logStep("Request data parsed", { eventId, ticketSelections });

    // Fetch event details
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError) throw new Error(`Event not found: ${eventError.message}`);
    logStep("Event found", { eventTitle: event.title });

    // Fetch ticket tiers
    const tierIds = ticketSelections.map(sel => sel.tierId);
    const { data: tiers, error: tiersError } = await supabaseClient
      .from('ticket_tiers')
      .select('*')
      .in('id', tierIds)
      .eq('event_id', eventId);

    if (tiersError) throw new Error(`Ticket tiers not found: ${tiersError.message}`);
    logStep("Ticket tiers found", { count: tiers.length });

    // Calculate line items
    const lineItems = ticketSelections.map(selection => {
      const tier = tiers.find(t => t.id === selection.tierId);
      if (!tier) throw new Error(`Tier not found: ${selection.tierId}`);

      return {
        price_data: {
          currency: tier.currency.toLowerCase(),
          product_data: {
            name: `${event.title} - ${tier.name}`,
            description: `Ticket for ${event.title}`,
            metadata: {
              event_id: eventId,
              tier_id: tier.id,
              badge_label: tier.badge_label || ''
            }
          },
          unit_amount: tier.price_cents,
        },
        quantity: selection.quantity,
      };
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer found");
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: "payment",
      success_url: `${req.headers.get("origin")}/ticket-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/events/${eventId}`,
      metadata: {
        event_id: eventId,
        user_id: user.id,
        ticket_selections: JSON.stringify(ticketSelections)
      }
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    // Create pending order in database using service role key
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const totalAmount = lineItems.reduce((sum, item) => 
      sum + (item.price_data.unit_amount * item.quantity), 0
    );

    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .insert({
        user_id: user.id,
        event_id: eventId,
        stripe_session_id: session.id,
        status: "pending",
        subtotal_cents: totalAmount,
        total_cents: totalAmount,
        currency: "USD"
      })
      .select()
      .single();

    if (orderError) throw new Error(`Order creation failed: ${orderError.message}`);
    logStep("Order created", { orderId: order.id });

    // Create order items
    const orderItems = ticketSelections.map(selection => {
      const tier = tiers.find(t => t.id === selection.tierId);
      return {
        order_id: order.id,
        tier_id: tier.id,
        quantity: selection.quantity,
        unit_price_cents: tier.price_cents
      };
    });

    const { error: itemsError } = await supabaseService
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw new Error(`Order items creation failed: ${itemsError.message}`);
    logStep("Order items created", { count: orderItems.length });

    return createResponse({ url: session.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return createErrorResponse(errorMessage);
  }
});