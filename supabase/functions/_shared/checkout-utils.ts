/**
 * Shared Checkout Utilities
 * 
 * Common functions used across all checkout flows (guest, authenticated, etc.)
 */

/**
 * Normalize email address for consistent storage and comparison
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

/**
 * Hash email address for privacy-preserving duplicate detection
 */
export async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Default express payment methods for Stripe Checkout
 */
export const defaultExpressMethods = {
  applePay: true,
  googlePay: true,
  link: true,
};

/**
 * Build contact snapshot for database storage
 * 
 * @param contact - Contact information object
 * @returns Normalized contact snapshot with email hash
 */
export async function buildContactSnapshot(contact: {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}): Promise<Record<string, unknown>> {
  const normalizedEmail = normalizeEmail(contact.email ?? null);
  return {
    email: normalizedEmail,
    name: contact.name ?? null,
    phone: contact.phone ?? null,
    email_hash: normalizedEmail ? await hashEmail(normalizedEmail) : null,
  };
}

/**
 * Build pricing snapshot for database storage
 * 
 * Converts camelCase pricing object to snake_case for Postgres
 */
export function buildPricingSnapshot(pricing: {
  subtotalCents: number;
  feesCents: number;
  totalCents: number;
  currency: string;
}): Record<string, unknown> {
  return {
    subtotal_cents: pricing.subtotalCents,
    fees_cents: pricing.feesCents,
    total_cents: pricing.totalCents,
    currency: pricing.currency ?? "USD",
  };
}

/**
 * Upsert a checkout session record
 * 
 * @param client - Supabase client with service role
 * @param payload - Checkout session data
 */
export async function upsertCheckoutSession(
  client: any,
  payload: {
    id: string;
    orderId: string;
    eventId: string;
    userId: string | null;
    holdIds?: string[];
    pricingSnapshot?: Record<string, unknown>;
    contactSnapshot?: Record<string, unknown>;
    verificationState?: Record<string, unknown>;
    expressMethods?: Record<string, boolean>;
    stripeSessionId?: string;
    expiresAt: string | Date;
    status?: string;
  }
): Promise<void> {
  // ✅ Use RPC to bypass PostgREST cache issue (PGRST204)
  const { error } = await client.rpc('upsert_checkout_session', {
    p_id: payload.id,
    p_order_id: payload.orderId,
    p_event_id: payload.eventId,
    p_user_id: payload.userId ?? null,
    p_hold_ids: payload.holdIds ?? [],
    p_pricing_snapshot: payload.pricingSnapshot ?? null,
    p_contact_snapshot: payload.contactSnapshot ?? null,
    p_verification_state: payload.verificationState ?? null,
    p_express_methods: payload.expressMethods ?? null,
    p_stripe_session_id: payload.stripeSessionId ?? null,
    p_expires_at: payload.expiresAt instanceof Date ? payload.expiresAt.toISOString() : payload.expiresAt,
    p_status: payload.status ?? "pending",
  });

  if (error) {
    console.error("[checkout-session] upsert failed", error);
    throw error;
  }
}

/**
 * Normalize an item from various payload formats
 * 
 * Handles both camelCase and snake_case variants
 */
export function normalizeItem(item: any) {
  return {
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
  };
}

/**
 * Resolve unit price in cents from various sources
 * 
 * @param item - Order item with potential price fields
 * @param tier - Ticket tier data (fallback for price)
 * @returns Unit price in cents
 */
export function resolveUnitPriceCents(item: any, tier: any | undefined): number {
  if (typeof item.unit_price_cents === "number") return item.unit_price_cents;
  if (typeof item.unitPriceCents === "number") return item.unitPriceCents;
  if (typeof item.faceValueCents === "number") return item.faceValueCents;
  if (typeof item.faceValue === "number") return Math.round(item.faceValue * 100);
  if (typeof tier?.price_cents === "number") return tier.price_cents;
  return 0;
}

/**
 * Generate a stable idempotency key for Stripe API calls
 * 
 * @param parts - Array of domain identifiers (e.g., ['checkout', sessionId, userId])
 * @param req - HTTP request (checks for x-idempotency-key header)
 * @returns Idempotency key string
 */
export function generateIdempotencyKey(parts: string[], req?: Request): string {
  const clientKey = req?.headers.get("x-idempotency-key");
  if (clientKey) return clientKey;
  
  return parts.filter(Boolean).join(':');
}

