import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Shared utilities (copied from _shared/checkout-session.ts)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const normalizeItem = (item: any) => ({
  tier_id: item?.tier_id ?? item?.tierId ?? null,
  quantity: Number(item?.quantity ?? 0),
  unit_price_cents: typeof item?.unit_price_cents === "number"
    ? item.unit_price_cents
    : typeof item?.unitPriceCents === "number"
      ? item.unitPriceCents
      : typeof item?.faceValueCents === "number"
        ? item.faceValueCents
        : typeof item?.faceValue === "number"
          ? Math.round(item.faceValue * 100)
          : undefined,
});

const resolveUnitPriceCents = (item: any, tier: any | undefined) => {
  if (typeof item.unit_price_cents === "number") return item.unit_price_cents;
  if (typeof item.unitPriceCents === "number") return item.unitPriceCents;
  if (typeof item.faceValueCents === "number") return item.faceValueCents;
  if (typeof item.faceValue === "number") return Math.round(item.faceValue * 100);
  if (typeof tier?.price_cents === "number") return tier.price_cents;
  return 0;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) {
      throw new Error("Missing required environment configuration");
    }

    const payload = await req.json();
    const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

    const authHeader = req.headers.get("Authorization");
    let authenticatedUser: any = null;
    
    // Only try to authenticate if we have a real JWT token (not anon key)
    if (authHeader) {
      const token = authHeader.replace("Bearer", "").trim();
      if (token && token !== ANON_KEY && token.length > 100) { // Real JWT tokens are longer
        try {
          const { data: userData, error: userError } = await supabaseAnon.auth.getUser(token);
          if (!userError && userData?.user) {
            authenticatedUser = userData.user;
          }
        } catch (error) {
          // Ignore JWT errors - user is not authenticated
          console.log("[enhanced-checkout] JWT validation failed, treating as unauthenticated");
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

    const { data: event, error: eventError } = await supabaseService
      .from("events")
      .select("id, title, owner_context_type, owner_context_id")
      .eq("id", orderData.event_id)
      .single();

    if (eventError || !event) {
      throw new Error("Event not found");
    }

    const { data: payoutDestination } = await supabaseService
      .from("payout_accounts")
      .select("*")
      .eq("context_type", event.owner_context_type)
      .eq("context_id", event.owner_context_id)
      .maybeSingle();

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

    const { data: reservationResult, error: reservationError } = await supabaseService
      .rpc("reserve_tickets_batch", {
        p_reservations: reservationItems,
        p_session_id: checkoutSessionId,
        p_user_id: orderData.user_id,
        p_expires_minutes: 15,
      });

    if (reservationError || !reservationResult?.success) {
      throw new Error(reservationResult?.error || "Failed to reserve tickets");
    }

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
      mode: "payment",
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : normalizedEmail ?? undefined,
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
      success_url: `${siteUrl}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/events/${orderData.event_id}`,
      allow_promotion_codes: true,
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

    if (payoutDestination?.stripe_connect_id && payoutDestination?.payouts_enabled) {
      sessionConfig.payment_intent_data = {
        ...sessionConfig.payment_intent_data,
        application_fee_amount: pricing.feesCents,
        transfer_data: {
          destination: payoutDestination.stripe_connect_id,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

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

    const cartSnapshot = {
      items: orderItemsPayload.map((item) => ({
        tier_id: item.tier_id,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        tier_name: tierMap.get(item.tier_id)?.name ?? null,
      })),
    };

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
      cartSnapshot,
      stripeSessionId: session.id,
      expiresAt: expiresAtIso,
      status: "pending",
    });

    return new Response(
      JSON.stringify({
        session_id: session.id,
        session_url: session.url,
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
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error)?.message ?? "Unknown error",
        error_code: "CHECKOUT_FAILED",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
