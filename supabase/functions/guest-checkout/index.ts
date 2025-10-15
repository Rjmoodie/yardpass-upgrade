import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

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

const normalizeEmail = (email: string) => email.trim().toLowerCase();

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

    const normalizedEmail = normalizeEmail(contactEmailRaw);
    const requestedName = payload.contact_name?.trim() || "";
    const requestedPhone = payload.contact_phone?.trim() || "";

    // Try to find existing user via auth.users email lookup
    let userId: string | null = null;
    let isNewUser = false;

    // If no profile found, try auth admin API as fallback
    if (!userId) {
      try {
        // Try the newer API first
        const { data: existingUserRes, error: existingUserErr } = await supabaseService.auth.admin.listUsers();
        if (!existingUserErr && existingUserRes?.users) {
          const existingUser = existingUserRes.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
          userId = existingUser?.id ?? null;
        }
      } catch (adminErr) {
        console.warn("[guest-checkout] auth.admin not available, will create new user", adminErr);
      }
    }

    if (!userId) {
      const displayName = requestedName || normalizedEmail.split("@")[0];
      
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

    const sessionId = crypto.randomUUID();
    const reservationItems = items.map((item) => ({
      tier_id: item.tier_id,
      quantity: item.quantity,
    }));

    const { data: reservationResult, error: reservationError } = await supabaseService
      .rpc("reserve_tickets_batch", {
        p_reservations: reservationItems,
        p_session_id: sessionId,
        p_user_id: userId,
        p_expires_minutes: 15,
      });

    if (reservationError || !reservationResult?.success) {
      console.error("[guest-checkout] reservation failed", reservationError || reservationResult?.error);
      return response({ error: reservationResult?.error || "Unable to reserve tickets" }, 409);
    }

    const calculateTotalCents = (faceValueCents: number) => {
      const faceValue = faceValueCents / 100;
      const processingFee = faceValue * 0.066 + 2.19;
      return Math.round((faceValue + processingFee) * 100);
    };

    // Calculate total with fees for the entire order
    const totalFaceValueCents = items.reduce((sum, item) => {
      const tier = tierMap.get(item.tier_id)!;
      return sum + (tier.price_cents * item.quantity);
    }, 0);
    
    const totalWithFees = calculateTotalCents(totalFaceValueCents);
    const totalFees = totalWithFees - totalFaceValueCents;

    const lineItems = items.map((item) => {
      const tier = tierMap.get(item.tier_id)!;
      const totalWithFees = calculateTotalCents(tier.price_cents);
      return {
        price_data: {
          currency: (tier.currency || "USD").toLowerCase(),
          product_data: {
            name: `${event.title} - ${tier.name}`,
            description: "Event ticket (includes processing fees)",
            metadata: {
              event_id: eventId,
              tier_id: tier.id,
            },
          },
          unit_amount: totalWithFees,
        },
        quantity: item.quantity,
      };
    });

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
          contact_email: normalizedEmail,
        },
        payment_intent_data: {
          description: `Tickets for ${event.title}`,
          metadata: {
            event_id: eventId,
            user_id: userId,
            contact_email: normalizedEmail,
            total_tickets: items.reduce((sum, item) => sum + item.quantity, 0),
          },
        },
      },
      { idempotencyKey }
    );

    const totalAmount = lineItems.reduce(
      (sum, item) => sum + item.price_data.unit_amount * (item.quantity || 0),
      0
    );

    const contactName = requestedName || profile?.display_name || normalizedEmail.split("@")[0];
    const contactPhone = requestedPhone || profile?.phone || null;

    const { data: order, error: orderErr } = await supabaseService
      .from("orders")
      .insert({
        user_id: userId,
        event_id: eventId,
        checkout_session_id: session.id,
        status: "pending",
        subtotal_cents: totalFaceValueCents,
        fees_cents: totalFees,
        total_cents: totalWithFees,
        currency: "USD",
        hold_ids: reservationResult.hold_ids || [],
        contact_email: normalizedEmail,
        contact_name: contactName,
        contact_phone: contactPhone,
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

    return response({ url: session.url });
  } catch (error) {
    console.error("[guest-checkout] unexpected error", error);
    return response({ error: (error as Error)?.message ?? "Unexpected error" }, 500);
  }
});
