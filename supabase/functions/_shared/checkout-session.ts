import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export interface CheckoutSessionUpsertInput {
  id: string;
  orderId: string;
  eventId: string;
  userId?: string | null;
  holdIds?: string[];
  pricingSnapshot?: Record<string, unknown> | null;
  contactSnapshot?: Record<string, unknown> | null;
  verificationState?: Record<string, unknown> | null;
  expressMethods?: Record<string, unknown> | null;
  cartSnapshot?: Record<string, unknown> | null;
  stripeSessionId?: string | null;
  expiresAt?: string | Date | null;
  status?: string;
}

export interface CheckoutSessionStatusUpdate {
  status?: string;
  verificationState?: Record<string, unknown> | null;
  expressMethods?: Record<string, unknown> | null;
  pricingSnapshot?: Record<string, unknown> | null;
  expiresAt?: string | Date | null;
  stripeSessionId?: string | null;
  contactSnapshot?: Record<string, unknown> | null;
}

export interface PricingBreakdown {
  subtotalCents: number;
  feesCents: number;
  totalCents: number;
  currency?: string;
}

export interface ContactDetails {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}

const toIsoString = (value: string | Date | null | undefined): string | null => {
  if (!value) return null;
  if (typeof value === "string") return new Date(value).toISOString();
  return value.toISOString();
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

export const buildPricingSnapshot = (pricing: PricingBreakdown): Record<string, unknown> => ({
  subtotal_cents: pricing.subtotalCents,
  fees_cents: pricing.feesCents,
  total_cents: pricing.totalCents,
  currency: pricing.currency ?? "USD",
});

export const buildContactSnapshot = async (contact: ContactDetails): Promise<Record<string, unknown>> => {
  const normalizedEmail = normalizeEmail(contact.email ?? null);
  return {
    email: normalizedEmail,
    name: contact.name ?? null,
    phone: contact.phone ?? null,
    email_hash: normalizedEmail ? await hashEmail(normalizedEmail) : null,
  };
};

export const defaultExpressMethods = {
  applePay: true,
  googlePay: true,
  link: true,
};

export const upsertCheckoutSession = async (
  client: SupabaseClient,
  payload: CheckoutSessionUpsertInput,
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
    expires_at: toIsoString(payload.expiresAt),
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

export const updateCheckoutSession = async (
  client: SupabaseClient,
  id: string,
  patch: CheckoutSessionStatusUpdate,
): Promise<void> => {
  const updateRecord: Record<string, unknown> = {};

  if (patch.status !== undefined) updateRecord.status = patch.status;
  if (patch.verificationState !== undefined) updateRecord.verification_state = patch.verificationState;
  if (patch.expressMethods !== undefined) updateRecord.express_methods = patch.expressMethods;
  if (patch.pricingSnapshot !== undefined) updateRecord.pricing_snapshot = patch.pricingSnapshot;
  if (patch.stripeSessionId !== undefined) updateRecord.stripe_session_id = patch.stripeSessionId;
  if (patch.contactSnapshot !== undefined) updateRecord.contact_snapshot = patch.contactSnapshot;

  if (patch.expiresAt !== undefined) {
    updateRecord.expires_at = toIsoString(patch.expiresAt);
  }

  if (!Object.keys(updateRecord).length) {
    return;
  }

  const { error } = await client
    .from("checkout_sessions")
    .update(updateRecord)
    .eq("id", id);

  if (error) {
    console.error("[checkout-session] update failed", error);
    throw error;
  }
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
