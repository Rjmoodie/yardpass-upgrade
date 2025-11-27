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

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

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

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      ui_mode: "embedded", // CRITICAL: Required for client_secret
      mode: "payment",
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : normalizedEmail ?? undefined,
      expires_at: Math.floor(new Date(expiresAtIso).getTime() / 1000), // Match ticket hold expiration (30min)
      return_url: `${siteUrl}/purchase-success?session_id={CHECKOUT_SESSION_ID}`, // For embedded, use return_url instead of success_url
      line_items: [
        {
          price_data: {
            currency: (currency ?? "USD").toLowerCase(),
            product_data: {
              name: lineItemLabel,
              description: "Event tickets (includes processing fees)",
            },
            unit_amount: pricing.totalCents,
          },
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      submit_type: "pay", // Button text: "Pay"
      billing_address_collection: "auto",
      phone_number_collection: {
        enabled: false, // We collect this ourselves
      },
      // Custom text for timer
      custom_text: {
        submit: {
          message: `Your tickets are reserved for ${Math.floor((new Date(expiresAtIso).getTime() - Date.now()) / 60000)} minutes. Complete your purchase to secure them!`,
        },
      },
      metadata: {
        event_id: orderData.event_id,
        user_id: orderData.user_id,
        checkout_session_id: checkoutSessionId,
        hold_ids: JSON.stringify(reservationResult.hold_ids ?? []),
      },
      payment_intent_data: {
        description: `${event.title ?? "Event"} tickets`,
        metadata: {
          event_id: orderData.event_id,
          user_id: orderData.user_id,
          checkout_session_id: checkoutSessionId,
          hold_ids: JSON.stringify(reservationResult.hold_ids ?? []),
        },
      },
    };

    // Configure destination charges if organizer is fully onboarded
    if (payoutDestination?.stripe_connect_id) {
      if (payoutDestination.payouts_enabled && payoutDestination.details_submitted) {
        // Organizer is fully verified - route funds to them
        sessionConfig.payment_intent_data = {
          ...sessionConfig.payment_intent_data,
          application_fee_amount: pricing.platformFeeCents, // ✅ Platform fee only (not total processing fee)
          transfer_data: {
            destination: payoutDestination.stripe_connect_id,
          },
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
        
        // Optional: Add metadata to track these cases
        sessionConfig.metadata = {
          ...sessionConfig.metadata,
          platform_hold: 'true',
          platform_hold_reason: 'organizer_not_verified'
        };
      }
    }

    // Phase 2.2.4: Enhanced idempotency key generation
    // Format: operation_type:stable_id:UUID
    const idempotencyKey = generateIdempotencyKey(
      'checkout:create',
      checkoutSessionId, // Stable ID from orders table
      req
    );

    // Phase 2.2.4: Check if operation already completed (idempotent retry)
    // Wrap in try-catch to make it truly non-blocking
    try {
      const { data: existingOp, error: checkError } = await supabaseService
        .rpc('check_stripe_idempotency', {
          p_operation_type: 'checkout:create',
          p_operation_id: checkoutSessionId
        });

      if (!checkError && existingOp) {
        // Parse JSONB response (might be string or object)
        const result = typeof existingOp === 'string' ? JSON.parse(existingOp) : existingOp;
        
        if (result?.is_completed && result?.stripe_resource_id) {
          // Operation already completed, return existing session
          console.log('[enhanced-checkout] Idempotent request - returning existing session', {
            checkoutSessionId,
            stripeSessionId: result.stripe_resource_id
          });
          return new Response(
            JSON.stringify({
              session_id: result.stripe_resource_id,
              idempotent: true
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } else if (checkError) {
        console.warn('[enhanced-checkout] Idempotency check failed (continuing):', checkError.message);
      }
    } catch (idempotencyError) {
      // Non-critical error - log and continue with checkout
      console.warn('[enhanced-checkout] Idempotency check error (non-blocking):', idempotencyError);
    }

    // Create session with retry logic and circuit breaker
    const session = await stripeCallWithResilience(
      supabaseService,
      () => stripe.checkout.sessions.create(sessionConfig, { idempotencyKey }),
      { operationName: 'checkout.sessions.create' }
    );

    // Phase 2.2.4: Record successful idempotency operation
    try {
      const { error: recordError } = await supabaseService.rpc('record_stripe_idempotency', {
        p_operation_type: 'checkout:create',
        p_operation_id: checkoutSessionId,
        p_stripe_idempotency_key: idempotencyKey,
        p_stripe_resource_id: session.id,
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
    
    console.log("[enhanced-checkout] Stripe session created:", {
      id: session.id,
      client_secret: session.client_secret ? 'present' : 'missing',
      url: session.url ? 'present' : 'missing',
      mode: session.mode,
      ui_mode: (sessionConfig as any).ui_mode,
    });
    
    // For embedded checkout, Stripe requires ui_mode = 'embedded'
    if (!session.client_secret) {
      console.warn("[enhanced-checkout] No client_secret - session might not be in embedded mode");
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
        stripe_session_id: session.id,
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
      stripeSessionId: session.id,
      expiresAt: expiresAtIso,
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        session_id: session.id,
        session_url: session.url,
        client_secret: session.client_secret, // For embedded checkout
        order_id: order.id,
        checkout_session_id: checkoutSessionId,
        expires_at: expiresAtIso,
        pricing: buildPricingSnapshot(pricing),
        destination_account: payoutDestination?.stripe_connect_id ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[enhanced-checkout] error", error);
    console.error("[enhanced-checkout] error stack", (error as Error)?.stack);
    console.error("[enhanced-checkout] error details", JSON.stringify(error, null, 2));
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error)?.message ?? "Unknown error",
        error_code: "CHECKOUT_FAILED",
        error_details: (error as any)?.details || (error as any)?.hint || null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
