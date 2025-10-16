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

    let userId: string | null = null;
    let isNewUser = false;

    try {
      const { data: existingUserRes, error: existingUserErr } = await supabaseService.auth.admin.listUsers();
      if (!existingUserErr && existingUserRes?.users) {
        const existingUser = existingUserRes.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
        userId = existingUser?.id ?? null;
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

        if (createErr || !created?.user) {
          console.error("[guest-checkout] createUser failed", createErr);
          return response({ error: "Failed to provision guest account" }, 500);
        }

        userId = created.user.id;
        isNewUser = true;

        const { error: profileErr } = await supabaseService
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
      } catch (createError) {
        console.error("[guest-checkout] Failed to create user", createError);
        return response({ error: "Unable to create guest account. Please try signing up first." }, 500);
      }
    }

    if (!userId) {
      return response({ error: "Unable to determine user for checkout" }, 500);
    }

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
      return response({ error: "Event not found" }, 404);
    }

    const tierIds = items.map((i) => i.tier_id);
    const { data: tiers, error: tiersErr } = await supabaseService
      .from("ticket_tiers")
      .select("id, name, price_cents, currency")
      .in("id", tierIds)
      .eq("event_id", eventId);

    if (tiersErr) {
      console.error("[guest-checkout] tier lookup error", tiersErr.message);
      return response({ error: "Unable to load ticket tiers" }, 400);
    }

    if (!tiers || tiers.length !== tierIds.length) {
      return response({ error: "One or more tiers are invalid for this event" }, 400);
    }

    const tierMap = new Map(tiers.map((tier) => [tier.id, tier]));

    const checkoutSessionId = crypto.randomUUID();
    const reservationItems = items.map((item) => ({
      tier_id: item.tier_id,
      quantity: item.quantity,
    }));

    const { data: reservationResult, error: reservationError } = await supabaseService
      .rpc("reserve_tickets_batch", {
        p_reservations: reservationItems,
        p_session_id: checkoutSessionId,
        p_user_id: userId,
        p_expires_minutes: 15,
      });

    if (reservationError || !reservationResult?.success) {
      console.error("[guest-checkout] reservation failed", reservationError || reservationResult?.error);
      return response({ error: reservationResult?.error || "Unable to reserve tickets" }, 409);
    }

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

    const session = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        customer_email: customerId ? undefined : normalizedEmail,
        line_items: lineItems,
        mode: "payment",
        success_url: `${siteUrl}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/?cancelled=true`,
        allow_promotion_codes: true,
        billing_address_collection: "required",
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

    const contactName = requestedName || profile?.display_name || (normalizedEmail ? normalizedEmail.split("@")[0] : "Guest");
    const contactPhone = requestedPhone || profile?.phone || null;

    const contactSnapshot = await buildContactSnapshot({
      email: normalizedEmail,
      name: contactName,
      phone: contactPhone ?? undefined,
    });

    const { data: order, error: orderErr } = await supabaseService
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

    if (orderErr) {
      console.error("[guest-checkout] failed to create order", orderErr.message);
      return response({ error: "Failed to create order" }, 500);
    }

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
      url: session.url,
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
