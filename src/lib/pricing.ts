/**
 * Liventix Fee Calculation - Frontend Implementation
 * 
 * Mirrors the backend pricing logic from supabase/functions/_shared/pricing.ts
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 * FEE STRUCTURE (Eventbrite-equivalent):
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Platform Fee = PLATFORM_PERCENT × ticketPrice + PLATFORM_FLAT
 * 
 * The buyer sees:
 *   Face Value + Processing Fee = Total
 * 
 * Where "Processing Fee" covers both platform fee and Stripe fee.
 * 
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 🎛️  CONFIGURABLE CONSTANTS - Must match backend pricing.ts
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

export interface FeeBreakdown {
  /** Face value of tickets (what organizer should receive) */
  faceValue: number;
  /** Single "Processing Fee" shown to buyer */
  processingFee: number;
  /** What the buyer is charged (faceValue + processingFee) */
  total: number;
  /** Platform fee component (for internal tracking) */
  platformFee: number;
  /** Stripe fee component (for internal tracking) */
  stripeFee: number;
  /** What the organizer receives (≈ faceValue) */
  organizerPayout: number;
}

/**
 * Round to cents (2 decimal places)
 */
function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate fees for a ticket purchase
 * 
 * @param faceValue - Face value of ticket(s) in dollars
 * @returns Complete breakdown with processingFee and total
 * 
 * @example
 * calculateFees(100)
 * // Returns: { faceValue: 100, processingFee: 8.95, total: 108.95, ... }
 */
export function calculateFees(faceValue: number): FeeBreakdown {
  // Free tickets have no fees
  if (faceValue <= 0) {
    return {
      faceValue: 0,
      processingFee: 0,
      total: 0,
      platformFee: 0,
      stripeFee: 0,
      organizerPayout: 0,
    };
  }

  // 1) Platform fee is based on face value (not buyer total)
  const platformFee = PLATFORM_FLAT + PLATFORM_PERCENT * faceValue;

  // 2) Gross up for Stripe fees: B = (T + P + Sf) / (1 - S%)
  //    This ensures after Stripe takes their cut, we have T + P remaining
  const totalRaw = (faceValue + platformFee + STRIPE_FLAT) / (1 - STRIPE_PERCENT);
  const total = roundToCents(totalRaw);

  // 3) Calculate actual Stripe fee based on total
  const stripeFee = roundToCents(total * STRIPE_PERCENT + STRIPE_FLAT);

  // 4) Processing fee = what buyer pays above face value
  const processingFee = roundToCents(total - faceValue);

  // 5) Organizer payout = total - Stripe fee - platform fee
  const organizerPayout = roundToCents(total - stripeFee - platformFee);

  return {
    faceValue,
    processingFee,
    total,
    platformFee: roundToCents(platformFee),
    stripeFee,
    organizerPayout,
  };
}

/**
 * Calculate fees for multiple tickets (summed face value)
 * 
 * Note: For per-ticket fees, call calculateFees for each ticket and sum.
 * This function is for when you have a total face value already.
 */
export function calculateFeesFromCents(faceValueCents: number): FeeBreakdown {
  return calculateFees(faceValueCents / 100);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Get fee description for UI display
 */
export function getFeeDescription(): string {
  const percentStr = (PLATFORM_PERCENT * 100).toFixed(1);
  const flatStr = PLATFORM_FLAT.toFixed(2);
  return `${percentStr}% + $${flatStr} per ticket`;
}

