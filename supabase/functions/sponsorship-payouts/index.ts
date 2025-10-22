// supabase/functions/sponsorship-payouts/index.ts
// Handles release of funds to event organizers via Stripe Connect
// Triggered when milestones are met or event is completed

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface PayoutRequest {
  order_id: string;
  stripe_transfer_id: string;
  amount_cents?: number;
  milestone_key?: string;
  notes?: string;
}

interface SponsorshipOrder {
  id: string;
  package_id: string;
  sponsor_id: string;
  event_id: string;
  amount_cents: number;
  application_fee_cents: number;
  status: string;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  milestone: Record<string, unknown>;
  created_at: string;
}

async function getOrder(orderId: string): Promise<SponsorshipOrder | null> {
  const { data, error } = await sb
    .from("sponsorship_orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error) {
    console.error("[getOrder] Error:", error);
    return null;
  }

  return data as SponsorshipOrder;
}

async function markReleased(
  orderId: string,
  stripeTransferId: string,
  amountCents?: number,
  milestoneKey?: string,
  notes?: string
): Promise<void> {
  const order = await getOrder(orderId);
  
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  // Check if already fulfilled
  if (order.status === "fulfilled") {
    console.warn(`[markReleased] Order ${orderId} already fulfilled`);
    return;
  }

  // Update milestone if provided
  const milestone = order.milestone || {};
  if (milestoneKey) {
    milestone[milestoneKey] = {
      released_at: new Date().toISOString(),
      stripe_transfer_id: stripeTransferId,
      amount_cents: amountCents || order.amount_cents - order.application_fee_cents,
    };
  }

  const { error } = await sb
    .from("sponsorship_orders")
    .update({
      status: "fulfilled",
      stripe_transfer_id: stripeTransferId,
      milestone: milestoneKey ? milestone : order.milestone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) {
    console.error("[markReleased] Update error:", error);
    throw error;
  }

  // Log the payout for audit trail
  console.log(`[markReleased] Order ${orderId} marked as fulfilled`, {
    order_id: orderId,
    transfer_id: stripeTransferId,
    amount: amountCents,
    milestone: milestoneKey,
  });

  // Update event sponsorship status if applicable
  await updateEventSponsorshipStatus(order.event_id, order.sponsor_id, notes);
}

async function updateEventSponsorshipStatus(
  eventId: string,
  sponsorId: string,
  notes?: string
): Promise<void> {
  try {
    const { error } = await sb
      .from("event_sponsorships")
      .update({
        activation_status: "completed",
        organizer_approved_at: new Date().toISOString(),
        roi_summary: {
          ...({} as Record<string, unknown>),
          payout_released_at: new Date().toISOString(),
          notes,
        },
      })
      .eq("event_id", eventId)
      .eq("sponsor_id", sponsorId);

    if (error) {
      console.error("[updateEventSponsorshipStatus] Error:", error);
    }
  } catch (e) {
    console.error("[updateEventSponsorshipStatus] Exception:", e);
  }
}

async function validatePayout(order: SponsorshipOrder): Promise<{
  valid: boolean;
  reason?: string;
}> {
  // Check if payment was received
  if (order.status !== "paid") {
    return { valid: false, reason: `Order status is ${order.status}, expected 'paid'` };
  }

  // Check if payment intent exists
  if (!order.stripe_payment_intent_id) {
    return { valid: false, reason: "No stripe_payment_intent_id found" };
  }

  // Check if already fulfilled
  if (order.stripe_transfer_id) {
    return { valid: false, reason: "Payout already released" };
  }

  // Check event is completed (optional, can be skipped for milestone-based payouts)
  const { data: event } = await sb
    .from("events")
    .select("completed_at, start_at, end_at")
    .eq("id", order.event_id)
    .single();

  if (event && !event.completed_at && event.end_at) {
    const now = new Date();
    const endDate = new Date(event.end_at);
    if (now < endDate) {
      return {
        valid: false,
        reason: `Event has not ended yet (ends at ${event.end_at})`,
      };
    }
  }

  // Check for deliverables completion (optional)
  const { data: sponsorship } = await sb
    .from("event_sponsorships")
    .select("deliverables, deliverables_submitted_at, organizer_approved_at")
    .eq("event_id", order.event_id)
    .eq("sponsor_id", order.sponsor_id)
    .single();

  if (sponsorship && sponsorship.deliverables) {
    const deliverables = sponsorship.deliverables as Record<string, { completed?: boolean }>;
    const allComplete = Object.values(deliverables).every((d) => d.completed);
    
    if (!allComplete) {
      return {
        valid: false,
        reason: "Not all deliverables are marked as completed",
      };
    }
  }

  return { valid: true };
}

// === EDGE FUNCTION HANDLER ===

serve(async (req) => {
  const startTime = Date.now();

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const body = (await req.json().catch(() => ({}))) as PayoutRequest;
    const { order_id, stripe_transfer_id, amount_cents, milestone_key, notes } = body;

    if (!order_id || !stripe_transfer_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: order_id, stripe_transfer_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get order details
    const order = await getOrder(order_id);
    if (!order) {
      return new Response(
        JSON.stringify({ error: `Order ${order_id} not found` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate payout eligibility
    const validation = await validatePayout(order);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          error: "Payout validation failed",
          reason: validation.reason,
          order_id,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Mark as released
    await markReleased(order_id, stripe_transfer_id, amount_cents, milestone_key, notes);

    const duration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        order_id,
        stripe_transfer_id,
        amount_released_cents: amount_cents || (order.amount_cents - order.application_fee_cents),
        milestone_key,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error("[sponsorship-payouts] Fatal error:", e);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(e),
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

