import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Import shared utilities
import {
  calculateProcessingFeeCents,
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
  generateIdempotencyKey,
} from "../_shared/checkout-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GuestCheckoutItem {
  tier_id: string;
  quantity: number;
  unit_price_cents?: number; // ⚠️ DEPRECATED: Ignored for security. Price always comes from database.
}

interface GuestCheckoutRequest {
  event_id: string;
  items: GuestCheckoutItem[];
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  guest_code?: string | null;
  city?: string;  // Optional: for duplicate detection
  country?: string;  // Optional: for duplicate detection
  theme?: string;  // Optional: theme preference ('night' for dark, 'stripe' for light)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as GuestCheckoutRequest;

    if (!payload || typeof payload !== "object") {
      return response({ error: "Invalid request" }, 400);
    }

    // Get theme preference from payload (optional)
    // Accepts 'dark'/'light' from client, or 'night'/'stripe' if already mapped
    const themeFromClient = payload?.theme || 'light';
    // Map to Stripe theme: 'dark' or 'night' -> 'night', everything else -> 'stripe'
    const stripeTheme = (themeFromClient === 'night' || themeFromClient === 'dark') ? 'night' : 'stripe';

    const eventId = String(payload.event_id || "").trim();
    const contactEmailRaw = String(payload.contact_email || "").trim();
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (!eventId) {
      return response({ error: "event_id is required" }, 400);
    }

    if (!contactEmailRaw || !EMAIL_RE.test(contactEmailRaw)) {
      return response({ error: "A valid email address is required" }, 400);
    }

    if (!items.length) {
      return response({ error: "At least one ticket selection is required" }, 400);
    }

    for (const item of items) {
      if (!item || typeof item !== "object") {
        return response({ error: "Invalid item payload" }, 400);
      }
      if (!item.tier_id || typeof item.tier_id !== "string") {
        return response({ error: "Each item requires a tier_id" }, 400);
      }
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        return response({ error: "Each item requires a positive quantity" }, 400);
      }
    }

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      throw new Error("Missing STRIPE_SECRET_KEY");
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });

    const normalizedEmail = normalizeEmail(contactEmailRaw) ?? "";
    const requestedName = payload.contact_name?.trim() || "";
    const requestedPhone = payload.contact_phone?.trim() || "";
    
    // 🔍 Extract location from client if provided (for duplicate detection)
    const clientCity = payload.city?.trim() || null;
    const clientCountry = payload.country?.trim() || null;

    let userId: string | null = null;
    let isNewUser = false;

    // Try to get existing user by email using getUsersByEmail which is more reliable
    try {
      const { data: existingUserRes, error: existingUserErr } = await supabaseService.auth.admin.listUsers();
      if (!existingUserErr && existingUserRes?.users) {
        const existingUser = existingUserRes.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
        
        if (existingUser) {
          // Check if this user was created via guest checkout
          const createdVia = existingUser.user_metadata?.created_via;
          
          if (createdVia === "guest_checkout") {
            // This is a previous guest - allow them to continue
            console.log("[guest-checkout] Found existing guest user, allowing to continue");
            userId = existingUser.id;
          } else {
            // This is a registered user - they should sign in
            console.log("[guest-checkout] Found registered user, prompting to sign in");
            return response({ 
              error: "An account with this email already exists. Please sign in to continue.",
              error_code: "user_exists",
              should_sign_in: true
            }, 409);
          }
        }
      }
    } catch (adminErr) {
      console.warn("[guest-checkout] auth.admin listUsers failed", adminErr);
    }

    if (!userId) {
      const displayName = requestedName || (normalizedEmail ? normalizedEmail.split("@")[0] : "Guest");

      try {
        const { data: created, error: createErr } = await supabaseService.auth.admin.createUser({
          email: normalizedEmail,
          email_confirm: true,
          user_metadata: {
            created_via: "guest_checkout",
            guest_checkout_at: new Date().toISOString(),
          },
          app_metadata: {
            roles: ["guest"],
          },
        });

        if (createErr) {
          console.error("[guest-checkout] createUser failed", createErr);
          
          // ✅ If user already exists, look them up and use their ID
          if (createErr.message?.includes("already been registered") || createErr.code === "email_exists") {
            console.log("[guest-checkout] User already exists, looking up via database...");
            
            // ✅ Enhanced duplicate detection: Check by email AND location
            try {
              console.log("[guest-checkout] User already exists, looking up user ID...");
              
              // ✅ Use RPC to get user_id directly (bypasses listUsers pagination)
              // @ts-ignore - Custom RPC
              const { data: existingUserId, error: rpcErr } = await supabaseService.rpc('get_user_id_by_email', {
                p_email: normalizedEmail
              });
              
              if (rpcErr) {
                console.error("[guest-checkout] RPC error looking up user:", rpcErr);
                return response({ 
                  error: "Unable to verify account. Please try again.",
                  error_code: "lookup_failed"
                }, 500);
              }
              
              if (existingUserId) {
                console.log("[guest-checkout] Found existing user ID:", existingUserId);
                
                // ✅ Second check: Compare location if provided
                if (clientCity || clientCountry) {
                  const { data: profile } = await supabaseService
                    .from("user_profiles")
                    .select("location, user_id")
                    .eq("user_id", existingUserId)
                    .maybeSingle();
                  
                  if (profile?.location) {
                    try {
                      const storedLocation = JSON.parse(profile.location);
                      const cityMatch = !clientCity || !storedLocation.city || 
                        storedLocation.city.toLowerCase() === clientCity.toLowerCase();
                      const countryMatch = !clientCountry || !storedLocation.country ||
                        storedLocation.country.toLowerCase() === clientCountry.toLowerCase();
                      
                      if (cityMatch && countryMatch) {
                        console.log("[guest-checkout] ✅ Location matches - same person");
                      } else {
                        console.warn("[guest-checkout] ⚠️ Location mismatch", {
                          stored: { city: storedLocation.city, country: storedLocation.country },
                          provided: { city: clientCity, country: clientCountry }
                        });
                        // Log but don't block - could be traveling, moved, etc.
                      }
                    } catch (parseErr) {
                      console.warn("[guest-checkout] Could not parse stored location");
                    }
                  }
                }
                
                console.log("[guest-checkout] Using existing user ID for checkout");
                userId = existingUserId;
                // ✅ Continue with this user's ID - no duplicates!
              } else {
                // RPC returned null - user doesn't exist (race condition)
                console.error("[guest-checkout] User should exist but RPC returned null");
                return response({ 
                  error: "An account issue occurred. Please try again.",
                  error_code: "user_lookup_failed"
                }, 500);
              }
            } catch (lookupErr) {
              console.error("[guest-checkout] User lookup failed:", lookupErr);
              return response({ 
                error: "Unable to verify account. Please try again.",
                error_code: "lookup_failed"
              }, 500);
            }
          } else {
            // Different createUser error (not "already exists")
            console.error("[guest-checkout] Different createUser error:", createErr);
            return response({ error: "Failed to provision guest account" }, 500);
          }
        }

        // Only process new user creation if we successfully created a user
        if (!userId && created?.user) {
          userId = created.user.id;
          isNewUser = true;

          const { error: profileErr} = await supabaseService
            .from("user_profiles")
            .upsert(
              {
                user_id: userId,
                display_name: displayName || "Guest",
                role: "attendee",
                phone: requestedPhone || null,
              },
              { onConflict: "user_id" }
            );

          if (profileErr) {
            console.warn("[guest-checkout] failed to upsert user profile", profileErr.message);
          }
        }
        
        // ✅ CRITICAL: userId is required - prevent duplicate/orphaned accounts
        if (!userId) {
          console.error("[guest-checkout] No userId after user creation/lookup");
          return response({ error: "Failed to provision guest account" }, 500);
        }
        
        console.log("[guest-checkout] ✅ User provisioning complete, userId:", userId);
      } catch (createError: any) {
        console.error("[guest-checkout] Failed to create user", createError);
        
        // Check if this is a duplicate email error
        if (createError.message?.includes("already been registered") || createError.code === "email_exists") {
          // Try to check if they're a guest user
          try {
            const { data: recheckRes } = await supabaseService.auth.admin.listUsers();
            const recheckUser = recheckRes?.users?.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
            
            if (recheckUser?.user_metadata?.created_via === "guest_checkout") {
              console.log("[guest-checkout] User exists as guest (caught in catch), allowing to continue");
              userId = recheckUser.id;
              // Don't return, continue with checkout
            } else {
              return response({ 
                error: "An account with this email already exists. Please sign in to continue.",
                error_code: "user_exists",
                should_sign_in: true
              }, 409);
            }
          } catch (recheckErr) {
            return response({ 
              error: "An account with this email already exists. Please sign in to continue.",
              error_code: "user_exists",
              should_sign_in: true
            }, 409);
          }
        } else {
          return response({ error: "Unable to create guest account. Please try signing up first." }, 500);
        }
      }
    }

    if (!userId) {
      console.error("[guest-checkout] No userId before event lookup");
      return response({ error: "Unable to determine user for checkout" }, 500);
    }

    console.log("[guest-checkout] Fetching event data for:", eventId);
    
    const { data: event, error: eventErr } = await supabaseService
      .from("events")
      .select("id, title, start_at, owner_context_type, owner_context_id")
      .eq("id", eventId)
      .maybeSingle();

    if (eventErr) {
      console.error("[guest-checkout] event lookup error", eventErr.message);
      return response({ error: "Event not found" }, 404);
    }

    if (!event) {
      console.error("[guest-checkout] Event not found for ID:", eventId);
      return response({ error: "Event not found" }, 404);
    }
    
    console.log("[guest-checkout] ✅ Event found:", event.title);

    // Check if event has already passed
    if (event.start_at) {
      const eventDate = new Date(event.start_at);
      const now = new Date();
      if (eventDate < now) {
        console.error("[guest-checkout] Event has passed:", { 
          eventDate: eventDate.toISOString(), 
          now: now.toISOString(),
          eventId,
          eventTitle: event.title
        });
        return response({
          error: "This event has already ended. Tickets are no longer available for purchase.",
          error_code: "EVENT_ENDED"
        }, 410);
      }
    }
    
    console.log("[guest-checkout] ✅ Event is upcoming, proceeding...");

    const tierIds = items.map((i) => i.tier_id);
    console.log("[guest-checkout] Fetching tiers", { eventId, tierIds });
    
    const { data: tiers, error: tiersErr } = await supabaseService
      .from("ticket_tiers")
      .select("id, name, price_cents, currency, event_id")
      .in("id", tierIds)
      .eq("event_id", eventId);

    if (tiersErr) {
      console.error("[guest-checkout] tier lookup error", tiersErr.message, { eventId, tierIds });
      return response({ error: "Unable to load ticket tiers" }, 400);
    }

    if (!tiers || tiers.length !== tierIds.length) {
      console.error("[guest-checkout] Invalid tier(s) for event", {
        eventId,
        requestedTierIds: tierIds,
        foundTierIds: tiers?.map(t => t.id) ?? [],
        foundTiers: tiers?.map(t => ({ id: t.id, name: t.name, event_id: t.event_id })) ?? []
      });
      return response({ error: "One or more tiers are invalid for this event" }, 400);
    }
    
    console.log("[guest-checkout] ✅ Tiers validated", {
      eventId,
      tiers: tiers.map(t => ({ id: t.id, name: t.name }))
    });

    // Check if organizer can accept payments
    const { data: payoutDestination } = await supabaseService
      .from("payout_accounts")
      .select("*")
      .eq("context_type", event.owner_context_type)
      .eq("context_id", event.owner_context_id)
      .maybeSingle();

    if (payoutDestination?.stripe_connect_id) {
      if (!payoutDestination.charges_enabled) {
        console.error('[guest-checkout] Organizer cannot accept payments', {
          eventId,
          contextType: event.owner_context_type,
          contextId: event.owner_context_id,
          chargesEnabled: payoutDestination.charges_enabled
        });
        
        return response({
          error: "This organizer cannot accept payments at this time. Please contact the event organizer or try again later.",
          error_code: "ORGANIZER_CHARGES_DISABLED"
        }, 503);
      }
    }

    const tierMap = new Map(tiers.map((tier) => [tier.id, tier]));

    const checkoutSessionId = crypto.randomUUID();
    const reservationItems = items.map((item) => ({
      tier_id: item.tier_id,
      quantity: item.quantity,
    }));

    console.log("[guest-checkout] Reserving tickets...", {
      checkoutSessionId,
      userId,
      reservationItems
    });

    const { data: reservationResult, error: reservationError } = await supabaseService
      .rpc("reserve_tickets_batch", {
        p_reservations: reservationItems,
        p_session_id: checkoutSessionId,
        p_user_id: userId,
        p_expires_minutes: 15,
      });

    console.log("[guest-checkout] Reservation result:", {
      success: reservationResult?.success,
      error: reservationError,
      resultError: reservationResult?.error
    });

    if (reservationError || !reservationResult?.success) {
      console.error("[guest-checkout] reservation failed", reservationError || reservationResult?.error);
      return response({ error: reservationResult?.error || "Unable to reserve tickets" }, 409);
    }
    
    console.log("[guest-checkout] ✅ Tickets reserved successfully");

    const expiresAtIso = reservationResult?.expires_at
      ? new Date(reservationResult.expires_at).toISOString()
      : new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // ✅ SECURITY FIX: Always use database price, never trust client-provided price
    // Log mismatch if client sends different price (for fraud monitoring)
    const totalFaceValueCents = items.reduce((sum, item) => {
      const tier = tierMap.get(item.tier_id)!;
      const dbPrice = tier.price_cents;
      
      // Log price mismatch for fraud monitoring (but always use DB price)
      if (typeof item.unit_price_cents === "number" && item.unit_price_cents !== dbPrice) {
        console.warn("[guest-checkout] ⚠️ Price mismatch detected (potential fraud attempt)", {
          tier_id: item.tier_id,
          client_price: item.unit_price_cents,
          db_price: dbPrice,
          event_id: eventId,
          contact_email: normalizedEmail
        });
      }
      
      // Always use database price (security-critical)
      return sum + dbPrice * item.quantity;
    }, 0);

    const pricing = buildPricingBreakdown(totalFaceValueCents, tiers[0]?.currency ?? "USD");

    const lineItems = [
      {
        price_data: {
          currency: (tiers[0]?.currency || "USD").toLowerCase(),
          product_data: {
            name: `${event.title} Tickets`,
            description: "Event tickets (includes processing fees)",
            metadata: {
              event_id: eventId,
              tiers: JSON.stringify(items.map((item) => ({ tier_id: item.tier_id, quantity: item.quantity }))),
            },
          },
          unit_amount: pricing.totalCents,
        },
        quantity: 1,
      },
    ];

    let customerId: string | undefined;
    const { data: profile } = await supabaseService
      .from("user_profiles")
      .select("stripe_customer_id, display_name, phone")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id;
    } else {
      const existingCustomers = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
      customerId = existingCustomers.data[0]?.id;
    }

    const siteUrl =
      req.headers.get("origin") ||
      Deno.env.get("SITE_URL") ||
      Deno.env.get("SUPABASE_URL") ||
      "http://localhost:5173";

    // Phase 2.2.4: Enhanced idempotency key generation
    // Format: operation_type:stable_id:UUID
    const idempotencyKey = generateIdempotencyKey(
      'checkout:create',
      checkoutSessionId, // Stable ID from orders table
      req
    );

    // Phase 2.2.4: Check if operation already completed (idempotent retry)
    const { data: existingOp, error: checkError } = await supabaseService
      .rpc('check_stripe_idempotency', {
        p_operation_type: 'payment_intent:create',
        p_operation_id: checkoutSessionId
      });

    if (checkError) {
      console.warn('[guest-checkout] Idempotency check failed (continuing):', checkError.message);
    } else if (existingOp?.is_completed && existingOp?.stripe_resource_id) {
      // Operation already completed, return existing PaymentIntent
      console.log('[guest-checkout] Idempotent request - returning existing PaymentIntent', {
        checkoutSessionId,
        paymentIntentId: existingOp.stripe_resource_id
      });
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(existingOp.stripe_resource_id);
        if (existingIntent.client_secret) {
          return response({
            client_secret: existingIntent.client_secret,
            payment_intent_id: existingIntent.id,
            checkout_session_id: checkoutSessionId,
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            stripeTheme,
            idempotent: true
          });
        }
      } catch (e) {
        console.warn("[guest-checkout] Failed to retrieve existing PaymentIntent:", e);
      }
    }

    // ✅ Handle FREE TICKETS - no Stripe payment needed
    if (pricing.totalCents === 0) {
      console.log('[guest-checkout] Free tickets - skipping Stripe, issuing directly');
      
      const freeContactName = requestedName || (normalizedEmail ? normalizedEmail.split("@")[0] : "Guest");
      const freeContactPhone = requestedPhone || null;
      
      // Create order for free tickets (use "paid" status since $0 = paid in full)
      const { data: freeOrder, error: freeOrderError } = await supabaseService
        .from('orders')
        .insert({
          user_id: userId,
          event_id: eventId,
          status: 'paid',
          paid_at: new Date().toISOString(),
          subtotal_cents: 0,
          fees_cents: 0,
          total_cents: 0,
          currency: tiers[0]?.currency ?? 'USD',
          contact_email: normalizedEmail,
          contact_name: freeContactName,
          contact_phone: freeContactPhone,
          hold_ids: reservationResult.hold_ids ?? [],
        })
        .select()
        .single();

      if (freeOrderError || !freeOrder) {
        console.error('[guest-checkout] Failed to create free order:', freeOrderError);
        throw new Error('Failed to create order');
      }

      // Create order items
      const freeOrderItems = items.map((item) => ({
        order_id: freeOrder.id,
        tier_id: item.tier_id,
        quantity: item.quantity,
        unit_price_cents: 0,
      }));

      await supabaseService.from('order_items').insert(freeOrderItems);

      // Convert holds to tickets
      const { error: ticketError } = await supabaseService.rpc(
        'convert_holds_to_tickets',
        {
          p_hold_ids: reservationResult.hold_ids ?? [],
          p_order_id: freeOrder.id,
        }
      );

      if (ticketError) {
        console.warn('[guest-checkout] convert_holds_to_tickets failed, trying direct insert:', ticketError);
        // Fallback: directly insert tickets
        for (const item of items) {
          for (let i = 0; i < item.quantity; i++) {
            await supabaseService.from('tickets').insert({
              order_id: freeOrder.id,
              tier_id: item.tier_id,
              user_id: userId,
              event_id: eventId,
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
      const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

      // 📧 Send RSVP/free ticket confirmation email
      try {
        const tierNames = items.map(item => {
          const tier = tierMap.get(item.tier_id);
          return tier?.name || 'Free Admission';
        }).join(', ');

        const emailPayload = {
          orderId: freeOrder.id,
          customerName: freeContactName || 'Guest',
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
          eventId: eventId,
          isRsvpOnly: true, // Flag for RSVP-style email
        };

        console.log('[guest-checkout] Sending RSVP confirmation email:', { orderId: freeOrder.id, email: normalizedEmail });
        
        await supabaseService.functions.invoke('send-purchase-confirmation', {
          body: emailPayload
        });
      } catch (emailErr) {
        console.warn('[guest-checkout] Failed to send confirmation email (non-critical):', emailErr);
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

    console.log("[guest-checkout] Creating PaymentIntent for Custom Checkout...", {
      customerId,
      email: normalizedEmail,
      totalCents: pricing.totalCents
    });

    // ✅ Custom Checkout: Create PaymentIntent instead of Checkout Session
    const paymentIntentConfig: Stripe.PaymentIntentCreateParams = {
      amount: pricing.totalCents,
      currency: (event.currency ?? "USD").toLowerCase(),
      description: `Tickets for ${event.title}`,
      customer: customerId,
      payment_method_types: ['card'], // Card payments only
      metadata: {
        event_id: eventId,
        user_id: userId,
        guest_checkout: isNewUser ? "true" : "false",
        hold_ids: JSON.stringify(reservationResult.hold_ids || []),
        checkout_session_id: checkoutSessionId,
        tiers: JSON.stringify(items.map((item) => ({ tier_id: item.tier_id, quantity: item.quantity }))),
        contact_email: normalizedEmail,
        total_tickets: items.reduce((sum, item) => sum + item.quantity, 0),
        theme: stripeTheme, // For reference
      },
    };

    // Configure destination charges if organizer is fully onboarded
    if (payoutDestination?.stripe_connect_id) {
      if (payoutDestination.payouts_enabled && payoutDestination.details_submitted) {
        paymentIntentConfig.application_fee_amount = pricing.platformFeeCents;
        paymentIntentConfig.transfer_data = {
          destination: payoutDestination.stripe_connect_id,
        };
      }
    }

    // Create PaymentIntent with retry logic and circuit breaker
    const paymentIntent: Stripe.PaymentIntent = await stripeCallWithResilience(
      supabaseService,
      () => stripe.paymentIntents.create(paymentIntentConfig, { idempotencyKey }),
      { operationName: 'paymentIntents.create' }
    ) as Stripe.PaymentIntent;

    // Phase 2.2.4: Record successful idempotency operation
    try {
      const { error: recordError } = await supabaseService.rpc('record_stripe_idempotency', {
        p_operation_type: 'payment_intent:create',
        p_operation_id: checkoutSessionId,
        p_stripe_idempotency_key: idempotencyKey,
        p_stripe_resource_id: paymentIntent.id,
        p_user_id: userId || null,
        p_metadata: {
          event_id: eventId,
          guest_checkout: isNewUser
        }
      });
      
      if (recordError) {
        // Non-critical - log but don't fail
        console.warn('[guest-checkout] Failed to record idempotency (non-critical):', recordError.message);
      }
    } catch (recordErr) {
      // Non-critical - log but don't fail
      console.warn('[guest-checkout] Failed to record idempotency (non-critical):', recordErr);
    }

    console.log("[guest-checkout] ✅ PaymentIntent created:", paymentIntent.id);
    
    if (!paymentIntent.client_secret) {
      throw new Error("PaymentIntent created but no client_secret returned");
    }

    const contactName = requestedName || profile?.display_name || (normalizedEmail ? normalizedEmail.split("@")[0] : "Guest");
    const contactPhone = requestedPhone || profile?.phone || null;

    const contactSnapshot = await buildContactSnapshot({
      email: normalizedEmail,
      name: contactName,
      phone: contactPhone ?? undefined,
    });

    console.log("[guest-checkout] Creating order in database...", {
      userId,
      eventId,
      checkoutSessionId,
      paymentIntentId: paymentIntent.id
    });

    let order;
    let orderErr;
    
    try {
      const orderInsertResult = await supabaseService
        .from("orders")
        .insert({
          user_id: userId,
          event_id: eventId,
          checkout_session_id: checkoutSessionId,
          stripe_payment_intent_id: paymentIntent.id, // ✅ Store PaymentIntent ID
          status: "pending",
          subtotal_cents: pricing.subtotalCents,
          fees_cents: pricing.feesCents,
          total_cents: pricing.totalCents,
          currency: (tiers[0]?.currency || "USD").toUpperCase(),
          hold_ids: reservationResult.hold_ids || [],
          contact_email: contactSnapshot.email ?? normalizedEmail,
          contact_name: contactSnapshot.name ?? contactName,
          contact_phone: contactSnapshot.phone ?? contactPhone,
        })
        .select()
        .single();
      
      order = orderInsertResult.data;
      orderErr = orderInsertResult.error;
      
      console.log("[guest-checkout] Order insert result:", {
        hasOrder: !!order,
        orderId: order?.id,
        error: orderErr,
        errorCode: orderErr?.code,
        errorMessage: orderErr?.message
      });
    } catch (insertException) {
      console.error("[guest-checkout] Exception during order insert:", insertException);
      return response({ error: "Failed to create order (exception)" }, 500);
    }

    if (orderErr) {
      console.error("[guest-checkout] Failed to create order:", {
        error: orderErr,
        code: orderErr.code,
        message: orderErr.message,
        details: orderErr.details,
        hint: orderErr.hint
      });
      return response({ error: "Failed to create order" }, 500);
    }
    
    if (!order) {
      console.error("[guest-checkout] No order returned from insert");
      return response({ error: "Failed to create order (no data)" }, 500);
    }
    
    console.log("[guest-checkout] ✅ Order created successfully:", order.id);

    const orderItems = items.map((item) => ({
      order_id: order.id,
      tier_id: item.tier_id,
      quantity: item.quantity,
      unit_price_cents: tierMap.get(item.tier_id)!.price_cents,
    }));

    const { error: itemsErr } = await supabaseService
      .from("order_items")
      .insert(orderItems);

    if (itemsErr) {
      console.error("[guest-checkout] failed to create order items", itemsErr.message);
      return response({ error: "Failed to create order items" }, 500);
    }

    // ✅ REMOVED: cartSnapshot - redundant (data already in order_items table)
    
    await upsertCheckoutSession(supabaseService, {
      id: checkoutSessionId,
      orderId: order.id,
      eventId,
      userId,
      holdIds: reservationResult.hold_ids ?? [],
      pricingSnapshot: buildPricingSnapshot(pricing),
      contactSnapshot,
      verificationState: { email_verified: !isNewUser, risk_score: 0 },
      expressMethods: defaultExpressMethods,
      stripeSessionId: paymentIntent.id, // ✅ Store PaymentIntent ID (using stripeSessionId field for now)
      expiresAt: expiresAtIso,
      status: "pending",
    });

    return response({
      client_secret: paymentIntent.client_secret, // ✅ For Custom Checkout (Payment Element)
      payment_intent_id: paymentIntent.id,
      checkout_session_id: checkoutSessionId,
      order_id: order.id,
      expires_at: expiresAtIso,
      pricing: buildPricingSnapshot(pricing),
      stripeTheme,
    });
  } catch (error) {
    console.error("[guest-checkout] unexpected error", error);
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
    } else if (/email.*exists|account.*exists/i.test(msg)) {
      userMsg = "An account with this email exists. Please sign in.";
      code = "ACCOUNT_EXISTS";
    } else if (/invalid.*email/i.test(msg)) {
      userMsg = "Please enter a valid email address.";
      code = "INVALID_EMAIL";
    }
    
    return response({ error: userMsg, error_code: code }, 500);
  }
});
