// supabase/functions/create-checkout/index.ts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ═══════════════════════════════════════════════════════════════════════════════
// CORS Headers (inlined from _shared/cors.ts)
// ═══════════════════════════════════════════════════════════════════════════════
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const handleCors = (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
};

const createResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const createErrorResponse = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ═══════════════════════════════════════════════════════════════════════════════
// Fee Calculation (inlined from _shared/pricing.ts)
// ═══════════════════════════════════════════════════════════════════════════════
const PLATFORM_PERCENT = 0.037;  // 3.7% of ticket price
const PLATFORM_FLAT = 1.79;      // $1.79 per ticket
const STRIPE_PERCENT = 0.029;    // 2.9%
const STRIPE_FLAT = 0.30;        // $0.30

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateGrossedUpCharge(ticketPrice: number) {
  if (ticketPrice <= 0) {
    return { buyerTotal: 0, processingFee: 0, stripeFee: 0, platformFee: 0, organizerPayout: 0 };
  }
  const platformFee = PLATFORM_FLAT + PLATFORM_PERCENT * ticketPrice;
  const buyerTotalRaw = (ticketPrice + platformFee + STRIPE_FLAT) / (1 - STRIPE_PERCENT);
  const buyerTotal = roundToCents(buyerTotalRaw);
  const stripeFee = roundToCents(buyerTotal * STRIPE_PERCENT + STRIPE_FLAT);
  const processingFee = roundToCents(buyerTotal - ticketPrice);
  const organizerPayout = roundToCents(buyerTotal - stripeFee - platformFee);
  return { buyerTotal, processingFee, stripeFee, platformFee: roundToCents(platformFee), organizerPayout };
}

interface CheckoutRequest {
  eventId: string;
  ticketSelections: {
    tierId: string;
    quantity: number;
  }[];
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

const getSiteUrl = (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  // Fallbacks if run without Origin header (e.g., via server-side)
  return (
    Deno.env.get("SITE_URL") ??
    Deno.env.get("SUPABASE_URL") ??
    "http://localhost:5173"
  );
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

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) throw new Error("Invalid bearer token");

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const normalizedEmail = user.email?.trim().toLowerCase() ?? null;

    // Service-role client for DB reads/writes (bypass RLS for edge function operations)
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    logStep("Service role key verified");

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
      { auth: { persistSession: false } },
    );

    const { data: profile } = await supabaseService
      .from("user_profiles")
      .select("display_name, phone")
      .eq("user_id", user.id)
      .maybeSingle();

    let parsed: CheckoutRequest | null = null;
    try {
      parsed = await req.json();
    } catch {
      throw new Error("Invalid JSON body");
    }

    const { eventId, ticketSelections } = parsed!;
    logStep("Request data parsed", { eventId, ticketSelections });

    if (!eventId) throw new Error("Missing eventId");
    if (!Array.isArray(ticketSelections) || ticketSelections.length === 0) {
      throw new Error("No ticket selections provided");
    }
    for (const s of ticketSelections) {
      if (!s?.tierId || typeof s.tierId !== "string") throw new Error("Invalid tierId in selection");
      if (!Number.isFinite(s?.quantity) || s.quantity <= 0) throw new Error("Invalid quantity in selection");
    }

    // Fetch event details using service role to bypass RLS
    const { data: event, error: eventError } = await supabaseService
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError) {
      logStep("Event query error", { error: eventError.message, code: eventError.code });
      throw new Error(`Event lookup failed: ${eventError.message}`);
    }
    if (!event) {
      logStep("Event not found in database", { eventId });
      throw new Error(`Event not found: ${eventId}`);
    }
    logStep("Event found", { eventTitle: event.title });

    // Fetch ticket tiers referenced by the selection (and ensure they belong to the event)
    const tierIds = ticketSelections.map((sel) => sel.tierId);
    const { data: tiers, error: tiersError } = await supabaseService
      .from("ticket_tiers")
      .select("*")
      .in("id", tierIds)
      .eq("event_id", eventId);

    if (tiersError) throw new Error(`Ticket tiers not found: ${tiersError.message}`);
    if (!tiers || tiers.length !== tierIds.length) throw new Error("One or more tiers do not belong to this event");
    logStep("Ticket tiers found", { count: tiers.length });

    // Reserve tickets atomically using the new system
    logStep("Attempting atomic ticket reservation");
    const reservationItems = ticketSelections.map(selection => ({
      tier_id: selection.tierId,
      quantity: selection.quantity
    }));

    const sessionId = crypto.randomUUID(); // Generate unique session ID
    const { data: reservationResult, error: reservationError } = await supabaseService
      .rpc('reserve_tickets_batch', {
        p_expires_minutes: 15,
        p_reservations: reservationItems,
        p_session_id: sessionId,
        p_user_id: user.id
      });

    if (reservationError || !reservationResult?.success) {
      logStep("Ticket reservation failed", reservationError || reservationResult?.error);
      throw new Error(reservationResult?.error || 'Failed to reserve tickets');
    }

    logStep("Tickets reserved successfully", reservationResult);

    // Calculate fees with Stripe gross-up (organizer gets 100% of faceValue)
    // Uses shared pricing module for consistency across all checkout flows
    const calculateTotal = (faceValueCents: number) => {
      // ✅ No processing fee for free tickets
      if (faceValueCents === 0) {
        logStep("Free tickets - no processing fee", { faceValueCents });
        return 0;
      }
      
      const faceValue = faceValueCents / 100;
      const result = calculateGrossedUpCharge(faceValue);
      const totalCents = Math.round(result.buyerTotal * 100);
      
      logStep("Fee calculation (with gross-up)", { 
        faceValueCents,
        faceValue,
        platformFee: result.platformFee,
        processingFee: result.processingFee,
        buyerTotal: result.buyerTotal,
        totalCents
      });
      
      return totalCents;
    };

    // Calculate Stripe line items with fees included
    const lineItems = ticketSelections.map((selection) => {
      const tier = tiers.find((t) => t.id === selection.tierId)!;
      const currency = (tier.currency || "USD").toLowerCase();
      const totalWithFees = calculateTotal(tier.price_cents);
      
      logStep("Creating line item", { 
        tierName: tier.name, 
        originalPrice: tier.price_cents, 
        totalWithFees 
      });
      
      return {
        price_data: {
          currency,
          product_data: {
            name: `${event.title} - ${tier.name}`,
            description: `Event ticket (includes processing fees)`,
            metadata: {
              event_id: eventId,
              tier_id: tier.id,
              badge_label: tier.badge_label || "",
              face_value_cents: tier.price_cents.toString(),
            },
          },
          unit_amount: totalWithFees,
        },
        quantity: selection.quantity,
      };
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Optionally reuse existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined = customers.data[0]?.id;
    if (customerId) logStep("Existing customer found", { customerId });

    // Create idempotency key (client can also send one)
    const idempotencyKey =
      req.headers.get("x-idempotency-key") ??
      (crypto?.randomUUID?.() ?? `${user.id}:${eventId}:${Date.now()}`);

    const siteUrl = getSiteUrl(req);

    // Create checkout session with fraud prevention
    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: lineItems,
        mode: "payment",
        success_url: `${siteUrl}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/?cancelled=true`,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        
        // Fraud prevention: Enable 3D Secure for high-risk transactions
        payment_method_options: {
          card: {
            request_three_d_secure: 'automatic', // Stripe decides based on risk
          },
        },
        
        metadata: {
          event_id: eventId,
          user_id: user.id,
          ticket_selections: JSON.stringify(ticketSelections),
          hold_ids: JSON.stringify(reservationResult.hold_ids || []),
          risk_context: 'ticket_purchase',
        },
        
        // Fraud prevention: Add detailed payment intent data
        payment_intent_data: {
          description: `Tickets for ${event.title}`,
          metadata: {
            event_id: eventId,
            user_id: user.id,
            user_email: user.email,
            total_tickets: ticketSelections.reduce((sum, s) => sum + s.quantity, 0),
          },
        },
      },
      { idempotencyKey }
    );

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    const totalAmount = lineItems.reduce(
      (sum, item) => sum + (item.price_data.unit_amount * (item.quantity || 0)),
      0
    );

    logStep("Tickets already reserved via atomic system");

    // Create pending order
    const contactName = profile?.display_name ?? (normalizedEmail ? normalizedEmail.split('@')[0] : null);
    const contactPhone = profile?.phone ?? null;

    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .insert({
        user_id: user.id,
        event_id: eventId,
        checkout_session_id: session.id,
        status: "pending",
        subtotal_cents: totalAmount,
        total_cents: totalAmount,
        currency: "USD",
        hold_ids: reservationResult.hold_ids || [],
        contact_email: normalizedEmail,
        contact_name: contactName,
        contact_phone: contactPhone,
      })
      .select()
      .single();

    if (orderError) {
      // Release the reserved tickets if creating the order fails
      try {
        await supabaseService.rpc('release_tickets_batch', {
          p_expires_minutes: 15,
          p_reservations: reservationItems,
          p_session_id: sessionId,
          p_user_id: user.id
        });
      } catch (releaseError) {
        logStep("Failed to release holds after order creation failure", releaseError);
      }
      throw new Error(`Order creation failed: ${orderError.message}`);
    }
    logStep("Order created", { orderId: order.id });

    // Create order items
    const orderItems = ticketSelections.map((selection) => {
      const tier = tiers.find((t) => t.id === selection.tierId)!;
      return {
        order_id: order.id,
        tier_id: tier.id,
        quantity: selection.quantity,
        unit_price_cents: tier.price_cents,
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
