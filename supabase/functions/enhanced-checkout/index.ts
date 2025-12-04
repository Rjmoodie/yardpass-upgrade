import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Import shared utilities
import {
  calculateProcessingFeeCents,
  calculatePlatformFeeCents,
  buildPricingBreakdown,
} from "../_shared/pricing.ts";
import { stripeCallWithResilience } from "../_shared/stripe-resilience.ts";
import {
  normalizeEmail,
  hashEmail,
  defaultExpressMethods,
  buildPricingSnapshot,
  buildContactSnapshot,
  upsertCheckoutSession,
  normalizeItem,
  resolveUnitPriceCents,
  generateIdempotencyKey,
} from "../_shared/checkout-utils.ts";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) {
      throw new Error("Missing required environment configuration");
    }

    const payload = await req.json();
    console.log("[enhanced-checkout] Received payload:", JSON.stringify(payload, null, 2));
    
    // Get theme preference from payload (optional)
    // Accepts 'dark'/'light' from client, or 'night'/'stripe' if already mapped
    const themeFromClient = payload?.theme || 'light';
    // Map to Stripe theme: 'dark' or 'night' -> 'night', everything else -> 'stripe'
    const stripeTheme = (themeFromClient === 'night' || themeFromClient === 'dark') ? 'night' : 'stripe';
    const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Get authenticated user from Supabase context (when verify_jwt = true)
    const authHeader = req.headers.get("Authorization");
    let authenticatedUser: any = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer", "").trim();
      if (token && token !== ANON_KEY && token.length > 100) {
        try {
          const { data: userData, error: userError } = await supabaseService.auth.getUser(token);
          if (!userError && userData?.user) {
            authenticatedUser = userData.user;
          }
        } catch (error) {
          console.log("[enhanced-checkout] JWT validation failed:", error);
        }
      }
    }

    let orderData = payload?.order_data ?? payload?.orderData ?? null;
    if (!orderData && payload?.eventId && payload?.ticketSelections) {
      // For member checkout, require authentication
      if (!authenticatedUser?.id) {
        return new Response(JSON.stringify({
          success: false,
          error: "Authentication required for member checkout",
          error_code: "AUTHENTICATION_REQUIRED"
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      orderData = {
        event_id: payload.eventId,
        user_id: authenticatedUser.id,
        items: payload.ticketSelections.map((sel: any) => ({
          tier_id: sel.tierId,
          quantity: sel.quantity,
          unit_price_cents: typeof sel.faceValue === "number" ? Math.round(sel.faceValue * 100) : sel.unit_price_cents,
        })),
      };
    }

    if (!orderData) {
      throw new Error("Order data is required");
    }

    orderData.event_id = orderData.event_id ?? orderData.eventId;
    orderData.user_id = orderData.user_id ?? orderData.userId ?? authenticatedUser?.id ?? null;
    if (!orderData.user_id) {
      throw new Error("Authenticated user required for enhanced checkout");
    }

    const normalizedItems = Array.isArray(orderData.items)
      ? orderData.items.map(normalizeItem).filter((item) => item.tier_id && item.quantity > 0)
      : [];

    if (!orderData.event_id) {
      throw new Error("event_id is required");
    }

    if (!normalizedItems.length) {
      throw new Error("At least one ticket selection is required");
    }

    console.log("[enhanced-checkout] Fetching event:", orderData.event_id);
    const { data: event, error: eventError } = await supabaseService
      .from("events")
      .select("id, title, owner_context_type, owner_context_id, start_at")
      .eq("id", orderData.event_id)
      .single();

    if (eventError || !event) {
      console.error("[enhanced-checkout] Event lookup failed:", eventError);
      throw new Error("Event not found");
    }
    console.log("[enhanced-checkout] Event found:", event.id);

    // Check if event has already passed
    if (event.start_at) {
      const eventDate = new Date(event.start_at);
      const now = new Date();
      if (eventDate < now) {
        console.log("[enhanced-checkout] Event has passed:", { eventDate, now });
        return new Response(JSON.stringify({
          success: false,
          error: "This event has already ended. Tickets are no longer available for purchase.",
          error_code: "EVENT_ENDED"
        }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // Fetch payout destination (organizer's Stripe account)
    const { data: payoutDestination } = await supabaseService
      .from("payout_accounts")
      .select("*")
      .eq("context_type", event.owner_context_type)
      .eq("context_id", event.owner_context_id)
      .maybeSingle();

    // Validate organizer can accept payments
    if (payoutDestination?.stripe_connect_id) {
      if (!payoutDestination.charges_enabled) {
        console.error('[enhanced-checkout] Organizer cannot accept payments', {
          eventId: orderData.event_id,
          contextType: event.owner_context_type,
          contextId: event.owner_context_id,
          chargesEnabled: payoutDestination.charges_enabled
        });
        
        return new Response(
          JSON.stringify({
            success: false,
            error: "This organizer cannot accept payments at this time. Please contact the event organizer or try again later.",
            error_code: "ORGANIZER_CHARGES_DISABLED"
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }

    const { data: profileRecord } = await supabaseService
      .from("user_profiles")
      .select("display_name, phone, stripe_customer_id")
      .eq("user_id", orderData.user_id)
      .maybeSingle();

    const checkoutSessionId = crypto.randomUUID();

    const reservationItems = normalizedItems.map((item) => ({
      tier_id: item.tier_id,
      quantity: item.quantity,
    }));

    console.log("[enhanced-checkout] Reserving tickets:", JSON.stringify(reservationItems));
    const { data: reservationResult, error: reservationError } = await supabaseService
      .rpc("reserve_tickets_batch", {
        p_reservations: reservationItems,
        p_session_id: checkoutSessionId,
        p_user_id: orderData.user_id,
        p_expires_minutes: 30, // Minimum for Stripe checkout sessions
      });

    if (reservationError || !reservationResult?.success) {
      console.error("[enhanced-checkout] Reservation failed:", reservationError || reservationResult);
      
      const errorMessage = reservationResult?.error || reservationError?.message || "Failed to reserve tickets";
      
      // Check if tickets are sold out
      if (errorMessage.includes("Only 0 tickets available") || 
          errorMessage.includes("not enough tickets") ||
          errorMessage.toLowerCase().includes("sold out")) {
        return new Response(JSON.stringify({
          success: false,
          error: "These tickets are currently sold out. Please check back later or select different tickets.",
          error_code: "SOLD_OUT",
          error_details: errorMessage
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      throw new Error(errorMessage);
    }
    console.log("[enhanced-checkout] Tickets reserved successfully");

    const expiresAtIso = reservationResult?.expires_at
      ? new Date(reservationResult.expires_at).toISOString()
      : new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const tierIds = reservationItems.map((item) => item.tier_id);
    const { data: tiers, error: tiersError } = await supabaseService
      .from("ticket_tiers")
      .select("id, name, price_cents, currency")
      .in("id", tierIds)
      .eq("event_id", orderData.event_id);

    if (tiersError) {
      throw new Error("Unable to load ticket tiers");
    }

    if (!tiers || tiers.length !== tierIds.length) {
      throw new Error("One or more ticket tiers are invalid");
    }

    const tierMap = new Map(tiers.map((tier: any) => [tier.id, tier]));

    const faceValueCents = normalizedItems.reduce((total, item) => {
      const tier = tierMap.get(item.tier_id);
      return total + resolveUnitPriceCents(item, tier) * item.quantity;
    }, 0);

    const currency = tiers[0]?.currency ?? "USD";
    const pricing = buildPricingBreakdown(faceValueCents, currency ?? "USD");

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

    const siteUrl = req.headers.get("origin")
      ?? Deno.env.get("SITE_URL")
      ?? Deno.env.get("SUPABASE_URL")
      ?? "http://localhost:5173";

    const normalizedEmail = normalizeEmail(orderData.contact_email ?? authenticatedUser?.email ?? null);
    const contactName = orderData.contact_name
      ?? profileRecord?.display_name
      ?? (normalizedEmail ? normalizedEmail.split("@")[0] : null);
    const contactPhone = orderData.contact_phone ?? profileRecord?.phone ?? null;

    const stripeCustomerId = profileRecord?.stripe_customer_id ?? undefined;

    const lineItemLabel = normalizedItems.length === 1
      ? `${event.title ?? "Event"} - ${tierMap.get(normalizedItems[0].tier_id)?.name ?? "Ticket"}`
      : `${event.title ?? "Event"} Tickets`;

    // ✅ Handle FREE TICKETS - no Stripe payment needed
    if (pricing.totalCents === 0) {
      console.log('[enhanced-checkout] Free tickets - skipping Stripe, issuing directly');
      
      // Create order for free tickets (use "paid" status since $0 = paid in full)
      const { data: freeOrder, error: freeOrderError } = await supabaseService
        .from('orders')
        .insert({
          user_id: orderData.user_id,
          event_id: orderData.event_id,
          status: 'paid',
          paid_at: new Date().toISOString(),
          subtotal_cents: 0,
          fees_cents: 0,
          total_cents: 0,
          currency: currency ?? 'USD',
          contact_email: normalizedEmail,
          contact_name: contactName,
          contact_phone: contactPhone,
          hold_ids: reservationResult.hold_ids ?? [],
        })
        .select()
        .single();

      if (freeOrderError || !freeOrder) {
        console.error('[enhanced-checkout] Failed to create free order:', freeOrderError);
        throw new Error('Failed to create order');
      }

      // Create order items
      const freeOrderItems = normalizedItems.map((item) => ({
        order_id: freeOrder.id,
        tier_id: item.tier_id,
        quantity: item.quantity,
        unit_price_cents: 0,
      }));

      await supabaseService.from('order_items').insert(freeOrderItems);

      // Convert holds to tickets using ensure-tickets pattern
      const { error: ticketError } = await supabaseService.rpc(
        'convert_holds_to_tickets',
        {
          p_hold_ids: reservationResult.hold_ids ?? [],
          p_order_id: freeOrder.id,
        }
      );

      if (ticketError) {
        console.warn('[enhanced-checkout] convert_holds_to_tickets failed, trying direct insert:', ticketError);
        // Fallback: directly insert tickets
        for (const item of normalizedItems) {
          for (let i = 0; i < item.quantity; i++) {
            await supabaseService.from('tickets').insert({
              order_id: freeOrder.id,
              tier_id: item.tier_id,
              user_id: orderData.user_id,
              event_id: orderData.event_id,
              status: 'issued',
            });
          }
        }
      }

      // Release the holds (they're now converted to tickets)
      await supabaseService
        .from('ticket_holds')
        .update({ status: 'converted' })
        .in('id', reservationResult.hold_ids ?? []);

      // Get issued ticket IDs for confirmation email
      const { data: issuedTickets } = await supabaseService
        .from('tickets')
        .select('id')
        .eq('order_id', freeOrder.id);

      const ticketIds = (issuedTickets || []).map((t: any) => t.id);
      const totalQuantity = normalizedItems.reduce((sum, i) => sum + i.quantity, 0);

      // 📧 Send RSVP/free ticket confirmation email
      try {
        const tierNames = normalizedItems.map(item => {
          const tier = tierMap.get(item.tier_id);
          return tier?.name || 'Free Admission';
        }).join(', ');

        const emailPayload = {
          orderId: freeOrder.id,
          customerName: contactName || 'Guest',
          customerEmail: normalizedEmail,
          eventTitle: event.title || 'Event',
          eventDate: event.start_at ? new Date(event.start_at).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          }) : 'TBA',
          eventLocation: event.location || event.venue || 'TBA',
          ticketType: tierNames,
          quantity: totalQuantity,
          totalAmount: 0, // Free tickets
          ticketIds,
          eventId: orderData.event_id,
          isRsvpOnly: true, // Flag for RSVP-style email
        };

        console.log('[enhanced-checkout] Sending RSVP confirmation email:', { orderId: freeOrder.id, email: normalizedEmail });
        
        await supabaseService.functions.invoke('send-purchase-confirmation', {
          body: emailPayload
        });
      } catch (emailErr) {
        console.warn('[enhanced-checkout] Failed to send confirmation email (non-critical):', emailErr);
        // Don't fail the request if email fails
      }

      // Return success for free tickets (no client_secret needed)
      return new Response(
        JSON.stringify({
          success: true,
          free_order: true,
          order_id: freeOrder.id,
          checkout_session_id: checkoutSessionId,
          tickets_issued: totalQuantity,
          message: 'Free tickets claimed successfully!',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ✅ Custom Checkout: Create PaymentIntent instead of Checkout Session
    // This allows full appearance theming on the client with Payment Element
    const paymentIntentConfig: Stripe.PaymentIntentCreateParams = {
      amount: pricing.totalCents,
      currency: (currency ?? "USD").toLowerCase(),
      description: lineItemLabel,
      customer: stripeCustomerId,
      payment_method_types: ['card'], // Card payments only
      metadata: {
        event_id: orderData.event_id,
        user_id: orderData.user_id,
        checkout_session_id: checkoutSessionId,
        hold_ids: JSON.stringify(reservationResult.hold_ids ?? []),
        theme: stripeTheme, // For reference
      },
    };

    // Configure destination charges if organizer is fully onboarded
    if (payoutDestination?.stripe_connect_id) {
      if (payoutDestination.payouts_enabled && payoutDestination.details_submitted) {
        // Organizer is fully verified - route funds to them
        paymentIntentConfig.application_fee_amount = pricing.platformFeeCents;
        paymentIntentConfig.transfer_data = {
          destination: payoutDestination.stripe_connect_id,
        };
        
        console.log('[enhanced-checkout] Routing funds to organizer', {
          stripeAccountId: payoutDestination.stripe_connect_id,
          platformFeeCents: pricing.platformFeeCents
        });
      } else {
        // Organizer exists but not fully verified - hold funds on platform
        console.warn('[enhanced-checkout] Organizer not fully verified, funds held by platform', {
          eventId: orderData.event_id,
          contextId: event.owner_context_id,
          payoutsEnabled: payoutDestination.payouts_enabled,
          detailsSubmitted: payoutDestination.details_submitted
        });
        
        // Add metadata to track these cases
        paymentIntentConfig.metadata = {
          ...paymentIntentConfig.metadata,
          platform_hold: 'true',
          platform_hold_reason: 'organizer_not_verified'
        };
      }
    }

    // Phase 2.2.4: Enhanced idempotency key generation
    // Format: operation_type:stable_id:UUID
    const idempotencyKey = generateIdempotencyKey(
      'payment_intent:create',
      checkoutSessionId, // Stable ID from orders table
      req
    );

    // Phase 2.2.4: Check if operation already completed (idempotent retry)
    // Wrap in try-catch to make it truly non-blocking
    try {
      const { data: existingOp, error: checkError } = await supabaseService
        .rpc('check_stripe_idempotency', {
          p_operation_type: 'payment_intent:create',
          p_operation_id: checkoutSessionId
        });

      if (!checkError && existingOp) {
        // Parse JSONB response (might be string or object)
        const result = typeof existingOp === 'string' ? JSON.parse(existingOp) : existingOp;
        
        if (result?.is_completed && result?.stripe_resource_id) {
          // Operation already completed, fetch the existing PaymentIntent to get client_secret
          console.log('[enhanced-checkout] Idempotent request - fetching existing PaymentIntent', {
            checkoutSessionId,
            paymentIntentId: result.stripe_resource_id
          });
          
          try {
            const existingIntent = await stripe.paymentIntents.retrieve(result.stripe_resource_id);
            if (existingIntent.client_secret) {
              return new Response(
                JSON.stringify({
                  payment_intent_id: existingIntent.id,
                  client_secret: existingIntent.client_secret,
                  checkout_session_id: checkoutSessionId,
                  expires_at: expiresAtIso,
                  idempotent: true
                }),
                {
                  status: 200,
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
              );
            }
          } catch (retrieveError) {
            console.warn('[enhanced-checkout] Failed to retrieve existing PaymentIntent, continuing with new checkout:', retrieveError);
            // Continue with new checkout if retrieval fails
          }
        }
      } else if (checkError) {
        console.warn('[enhanced-checkout] Idempotency check failed (continuing):', checkError.message);
      }
    } catch (idempotencyError) {
      // Non-critical error - log and continue with checkout
      console.warn('[enhanced-checkout] Idempotency check error (non-blocking):', idempotencyError);
    }

    // ✅ Custom Checkout: Create PaymentIntent with retry logic and circuit breaker
    const paymentIntent = await stripeCallWithResilience(
      supabaseService,
      () => stripe.paymentIntents.create(paymentIntentConfig, { idempotencyKey }),
      { operationName: 'paymentIntents.create' }
    );

    // Phase 2.2.4: Record successful idempotency operation
    try {
      const { error: recordError } = await supabaseService.rpc('record_stripe_idempotency', {
        p_operation_type: 'payment_intent:create',
        p_operation_id: checkoutSessionId,
        p_stripe_idempotency_key: idempotencyKey,
        p_stripe_resource_id: paymentIntent.id,
        p_user_id: orderData.user_id,
        p_metadata: {
          event_id: orderData.event_id,
          order_id: orderData.id || null
        }
      });
      
      if (recordError) {
        // Non-critical - log but don't fail
        console.warn('[enhanced-checkout] Failed to record idempotency (non-critical):', recordError.message);
      }
    } catch (recordErr) {
      // Non-critical - log but don't fail
      console.warn('[enhanced-checkout] Failed to record idempotency (non-critical):', recordErr);
    }
    
    console.log("[enhanced-checkout] PaymentIntent created:", {
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret ? 'present' : 'missing',
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
    
    if (!paymentIntent.client_secret) {
      throw new Error("PaymentIntent created but no client_secret returned");
    }

    const contactSnapshot = await buildContactSnapshot({
      email: normalizedEmail,
      name: contactName,
      phone: contactPhone ?? undefined,
    });

    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .insert({
        event_id: orderData.event_id,
        user_id: orderData.user_id,
        stripe_payment_intent_id: paymentIntent.id, // ✅ Store PaymentIntent ID instead of session ID
        checkout_session_id: checkoutSessionId,
        status: "pending",
        currency: (currency ?? "USD").toUpperCase(),
        subtotal_cents: pricing.subtotalCents,
        fees_cents: pricing.feesCents,
        total_cents: pricing.totalCents,
        payout_destination_owner: payoutDestination?.context_type ?? null,
        payout_destination_id: payoutDestination?.context_id ?? null,
        hold_ids: reservationResult.hold_ids ?? [],
        contact_email: contactSnapshot.email ?? normalizedEmail,
        contact_name: contactSnapshot.name ?? contactName,
        contact_phone: contactSnapshot.phone ?? contactPhone,
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message ?? "Failed to create order");
    }

    const orderItemsPayload = normalizedItems.map((item) => ({
      order_id: order.id,
      tier_id: item.tier_id,
      quantity: item.quantity,
      unit_price_cents: resolveUnitPriceCents(item, tierMap.get(item.tier_id)),
    }));

    const { error: itemsError } = await supabaseService
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsError) {
      throw new Error(itemsError.message ?? "Failed to create order items");
    }

    // ✅ REMOVED: cartSnapshot - redundant (data already in order_items table)
    
    await upsertCheckoutSession(supabaseService, {
      id: checkoutSessionId,
      orderId: order.id,
      eventId: orderData.event_id,
      userId: orderData.user_id,
      holdIds: reservationResult.hold_ids ?? [],
      pricingSnapshot: buildPricingSnapshot(pricing),
      contactSnapshot,
      verificationState: { email_verified: true, risk_score: 0 },
      expressMethods: defaultExpressMethods,
      stripeSessionId: paymentIntent.id, // ✅ Store PaymentIntent ID (using stripeSessionId field for now)
      expiresAt: expiresAtIso,
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret, // ✅ For Custom Checkout (Payment Element)
        order_id: order.id,
        checkout_session_id: checkoutSessionId,
        expires_at: expiresAtIso,
        pricing: buildPricingSnapshot(pricing),
        destination_account: payoutDestination?.stripe_connect_id ?? null,
        stripeTheme, // Send back to client for reference
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[enhanced-checkout] error", error);
    const msg = (error as Error)?.message ?? "";
    
    // User-friendly error mapping
    let userMsg = "We couldn't process your request. Please try again.";
    let code = "CHECKOUT_FAILED";
    
    if (/sold out|unavailable|insufficient/i.test(msg)) {
      userMsg = "Sorry, these tickets are no longer available.";
      code = "TICKETS_UNAVAILABLE";
    } else if (/expired/i.test(msg)) {
      userMsg = "Your reservation has expired. Please start again.";
      code = "RESERVATION_EXPIRED";
    } else if (/auth|unauthorized/i.test(msg)) {
      userMsg = "Please sign in again.";
      code = "AUTH_REQUIRED";
    }
    
    return new Response(
      JSON.stringify({ success: false, error: userMsg, error_code: code }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
