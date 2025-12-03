/**
 * Liventix Fee Calculation - Plug & Play Configuration
 * 
 * This module provides canonical fee calculation logic used across all checkout
 * implementations (enhanced-checkout, guest-checkout, etc.).
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 * FEE STRUCTURE (Eventbrite-equivalent):
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Platform Fee = PLATFORM_PERCENT × ticketPrice + PLATFORM_FLAT
 * 
 * The buyer pays a single "Processing Fee" that covers:
 *   - Platform fee (what Liventix keeps)
 *   - Stripe fee (2.9% + $0.30, automatically deducted by Stripe)
 * 
 * Formula ensures:
 *   ✅ Organizer receives exactly the ticket face value
 *   ✅ Platform receives full platform fee
 *   ✅ Stripe receives full payment processing fee
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 🎛️  CONFIGURABLE CONSTANTS - Change these to adjust your fee structure
// ═══════════════════════════════════════════════════════════════════════════════

/** Platform percentage fee (e.g., 0.037 = 3.7% of ticket price) */
export const PLATFORM_PERCENT = 0.037;

/** Platform flat fee in dollars (e.g., 1.79 = $1.79 per ticket) */
export const PLATFORM_FLAT = 1.79;

/** Stripe percentage fee (standard: 2.9%) */
export const STRIPE_PERCENT = 0.029;

/** Stripe flat fee in dollars (standard: $0.30 per transaction) */
export const STRIPE_FLAT = 0.30;

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 FEE CALCULATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface GrossUpResult {
  /** What the buyer is charged (face value + processing fee) */
  buyerTotal: number;
  /** Single "Processing Fee" shown to buyer */
  processingFee: number;
  /** What Stripe keeps (for internal tracking) */
  stripeFee: number;
  /** What platform keeps (for Stripe Connect application_fee_amount) */
  platformFee: number;
  /** What the organizer receives (≈ ticket face value) */
  organizerPayout: number;
}

/**
 * Round to cents (2 decimal places)
 */
function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate grossed-up charge ensuring organizer gets face value
 * 
 * @param ticketPrice - Face value of ticket (what organizer should receive)
 * @returns Complete breakdown of buyer total, fees, and organizer payout
 * 
 * @example
 * calculateGrossedUpCharge(100)
 * // Returns: { buyerTotal: 108.95, processingFee: 8.95, platformFee: 5.49, ... }
 */
export function calculateGrossedUpCharge(ticketPrice: number): GrossUpResult {
  // Free tickets have no fees
  if (ticketPrice <= 0) {
    return {
      buyerTotal: 0,
      processingFee: 0,
      stripeFee: 0,
      platformFee: 0,
      organizerPayout: 0,
    };
  }

  // 1) Platform fee is based on ticket price (not buyer total)
  const platformFee = PLATFORM_FLAT + PLATFORM_PERCENT * ticketPrice;

  // 2) Gross up for Stripe fees: B = (T + P + Sf) / (1 - S%)
  //    This ensures after Stripe takes their cut, we have T + P remaining
  const buyerTotalRaw = (ticketPrice + platformFee + STRIPE_FLAT) / (1 - STRIPE_PERCENT);
  const buyerTotal = roundToCents(buyerTotalRaw);

  // 3) Calculate actual Stripe fee based on buyer total
  const stripeFee = roundToCents(buyerTotal * STRIPE_PERCENT + STRIPE_FLAT);

  // 4) Processing fee = what buyer pays above face value
  const processingFee = roundToCents(buyerTotal - ticketPrice);

  // 5) Organizer payout = buyer total - Stripe fee - platform fee
  const organizerPayout = roundToCents(buyerTotal - stripeFee - platformFee);

  return {
    buyerTotal,
    processingFee,
    stripeFee,
    platformFee: roundToCents(platformFee),
    organizerPayout,
  };
}

/**
 * Calculate processing fee in cents (for backward compatibility)
 * 
 * @param faceValueCents - Ticket face value in cents (e.g., 10000 = $100.00)
 * @returns Processing fee in cents that should be added to the face value
 */
export function calculateProcessingFeeCents(faceValueCents: number): number {
  if (faceValueCents <= 0) return 0;
  
  const result = calculateGrossedUpCharge(faceValueCents / 100);
  return Math.round(result.processingFee * 100);
}

/**
 * Calculate platform fee in cents (for Stripe Connect application_fee_amount)
 * 
 * @param faceValueCents - Ticket face value in cents
 * @returns Platform fee in cents for Stripe Connect
 */
export function calculatePlatformFeeCents(faceValueCents: number): number {
  if (faceValueCents <= 0) return 0;
  
  const result = calculateGrossedUpCharge(faceValueCents / 100);
  return Math.round(result.platformFee * 100);
}

/**
 * Build complete pricing breakdown for an order
 * 
 * @param faceValueCents - Total ticket face value in cents
 * @param currency - Currency code (default: "USD")
 * @returns Complete pricing breakdown with all components
 */
export function buildPricingBreakdown(
  faceValueCents: number,
  currency = "USD"
) {
  const result = calculateGrossedUpCharge(faceValueCents / 100);
  
  return {
    subtotalCents: faceValueCents,
    feesCents: Math.round(result.processingFee * 100),
    totalCents: Math.round(result.buyerTotal * 100),
    platformFeeCents: Math.round(result.platformFee * 100),
    currency,
  };
}

/**
 * Build pricing snapshot for database storage (snake_case for Postgres)
 */
export function buildPricingSnapshot(pricing: ReturnType<typeof buildPricingBreakdown>): Record<string, unknown> {
  return {
    subtotal_cents: pricing.subtotalCents,
    fees_cents: pricing.feesCents,
    total_cents: pricing.totalCents,
    currency: pricing.currency ?? "USD",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 FEE SCHEDULE REFERENCE
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Example calculations with current settings (3.7% + $1.79):
 * 
 * | Ticket | Platform Fee | Buyer Pays | Stripe Gets | Platform Gets | Organizer Gets |
 * |--------|--------------|------------|-------------|---------------|----------------|
 * | $20    | $2.53        | $23.56     | $0.98       | $2.53         | $20.05         |
 * | $50    | $3.64        | $55.59     | $1.91       | $3.64         | $50.04         |
 * | $100   | $5.49        | $108.95    | $3.46       | $5.49         | $100.00        |
 * | $200   | $9.19        | $215.85    | $6.56       | $9.19         | $200.10        |
 * 
 * Effective take rate: 3.7% + $1.79/ticket ≈ 5.5% on $100 ticket
 */
