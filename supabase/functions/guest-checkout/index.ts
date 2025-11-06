import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Shared utilities (copied from _shared/checkout-session.ts)
export const normalizeEmail = (email: string | null | undefined): string | null => {
  if (!email) return null;
  return email.trim().toLowerCase();
};

export const hashEmail = async (email: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(email);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const defaultExpressMethods = {
  applePay: true,
  googlePay: true,
  link: true,
};

export const calculateProcessingFeeCents = (faceValueCents: number): number => {
  const faceValue = faceValueCents / 100;
  const fee = faceValue * 0.066 + 2.19;
  return Math.round(fee * 100);
};

export const buildPricingBreakdown = (faceValueCents: number, currency = "USD") => {
  const feesCents = calculateProcessingFeeCents(faceValueCents);
  const totalCents = faceValueCents + feesCents;
  return {
    subtotalCents: faceValueCents,
    feesCents,
    totalCents,
    currency,
  };
};

export const buildPricingSnapshot = (pricing: any): Record<string, unknown> => ({
  subtotal_cents: pricing.subtotalCents,
  fees_cents: pricing.feesCents,
  total_cents: pricing.totalCents,
  currency: pricing.currency ?? "USD",
});

export const buildContactSnapshot = async (contact: any): Promise<Record<string, unknown>> => {
  const normalizedEmail = normalizeEmail(contact.email ?? null);
  return {
    email: normalizedEmail,
    name: contact.name ?? null,
    phone: contact.phone ?? null,
    email_hash: normalizedEmail ? await hashEmail(normalizedEmail) : null,
  };
};

export const upsertCheckoutSession = async (
  client: any,
  payload: any,
): Promise<void> => {
  const record: Record<string, unknown> = {
    id: payload.id,
    order_id: payload.orderId,
    event_id: payload.eventId,
    user_id: payload.userId ?? null,
    hold_ids: payload.holdIds ?? [],
    pricing_snapshot: payload.pricingSnapshot ?? null,
    contact_snapshot: payload.contactSnapshot ?? null,
    verification_state: payload.verificationState ?? null,
    express_methods: payload.expressMethods ?? null,
    cart_snapshot: payload.cartSnapshot ?? null,
    stripe_session_id: payload.stripeSessionId ?? null,
    expires_at: payload.expiresAt instanceof Date ? payload.expiresAt.toISOString() : payload.expiresAt,
    status: payload.status ?? "pending",
  };

  const { error } = await client
    .from("checkout_sessions")
    .upsert(record, { onConflict: "id" });

  if (error) {
    console.error("[checkout-session] upsert failed", error);
    throw error;
  }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GuestCheckoutItem {
  tier_id: string;
  quantity: number;
  unit_price_cents?: number;
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

    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });

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

    const totalFaceValueCents = items.reduce((sum, item) => {
      const tier = tierMap.get(item.tier_id)!;
      const unitPrice = typeof item.unit_price_cents === "number" ? item.unit_price_cents : tier.price_cents;
      return sum + unitPrice * item.quantity;
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

    const idempotencyKey = req.headers.get("x-idempotency-key") || `${userId}:${Date.now()}`;

    console.log("[guest-checkout] Creating Stripe checkout session...", {
      customerId,
      email: normalizedEmail,
      totalCents: pricing.totalCents
    });

    const session = await stripe.checkout.sessions.create(
      {
        ui_mode: "embedded", // Enable embedded checkout
        customer: customerId,
        customer_email: customerId ? undefined : normalizedEmail,
        line_items: lineItems,
        mode: "payment",
        return_url: `${siteUrl}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
        allow_promotion_codes: true,
        billing_address_collection: "required",
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes from now
        metadata: {
          event_id: eventId,
          user_id: userId,
          guest_checkout: isNewUser ? "true" : "false",
          hold_ids: JSON.stringify(reservationResult.hold_ids || []),
          checkout_session_id: checkoutSessionId,
          tiers: JSON.stringify(items.map((item) => ({ tier_id: item.tier_id, quantity: item.quantity }))),
          contact_email: normalizedEmail,
        },
        payment_intent_data: {
          description: `Tickets for ${event.title}`,
          metadata: {
            event_id: eventId,
            user_id: userId,
            checkout_session_id: checkoutSessionId,
            contact_email: normalizedEmail,
            total_tickets: items.reduce((sum, item) => sum + item.quantity, 0),
          },
        },
      },
      { idempotencyKey }
    );

    console.log("[guest-checkout] ✅ Stripe session created:", session.id);

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
      stripeSessionId: session.id
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
          stripe_session_id: session.id,
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

    const cartSnapshot = {
      items: orderItems.map((item) => ({
        tier_id: item.tier_id,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        tier_name: tierMap.get(item.tier_id)?.name ?? null,
      })),
    };

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
      cartSnapshot,
      stripeSessionId: session.id,
      expiresAt: expiresAtIso,
      status: "pending",
    });

    return response({
      client_secret: session.client_secret, // For embedded checkout
      checkout_session_id: checkoutSessionId,
      order_id: order.id,
      expires_at: expiresAtIso,
      pricing: buildPricingSnapshot(pricing),
    });
  } catch (error) {
    console.error("[guest-checkout] unexpected error", error);
    return response({ error: (error as Error)?.message ?? "Unexpected error" }, 500);
  }
});
