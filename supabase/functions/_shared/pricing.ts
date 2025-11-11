/**
 * Shared pricing and fee calculation utilities for YardPass checkout flows
 * 
 * This module provides canonical fee calculation logic used across all checkout
 * implementations (enhanced-checkout, guest-checkout, etc.).
 * 
 * Fee Structure:
 * - Platform target fee: 6.6% + $1.79 per order (Eventbrite-equivalent)
 * - Gross up for Stripe fees: 2.9% + $0.30 per transaction
 * - Total processing fee = what customer pays - face value
 */

/**
 * Calculate processing fee in cents
 * 
 * @param faceValueCents - Ticket face value in cents (e.g., 1000 = $10.00)
 * @returns Processing fee in cents that should be added to the face value
 * 
 * @example
 * calculateProcessingFeeCents(0)     // 0 (free tickets = no fees)
 * calculateProcessingFeeCents(1000)  // ~350 ($3.50 fee for $10 ticket)
 * calculateProcessingFeeCents(10000) // ~2446 ($24.46 fee for $100 ticket)
 */
export function calculateProcessingFeeCents(faceValueCents: number): number {
  // Free tickets have no processing fees
  if (faceValueCents <= 0) return 0;
  
  const faceValue = faceValueCents / 100;
  
  // Platform fee target (what we want to net after Stripe takes their cut)
  // 6.6% + $1.79 is competitive with Eventbrite's pricing
  const platformFeeTarget = faceValue * 0.066 + 1.79;
  
  // Total net needed = face value + our platform fee
  const totalNetNeeded = faceValue + platformFeeTarget;
  
  // Gross up to cover Stripe's 2.9% + $0.30
  // Formula: total_charge = (total_net + 0.30) / (1 - 0.029)
  const totalCharge = (totalNetNeeded + 0.30) / 0.971;
  
  // Processing fee = total customer pays - face value
  const processingFee = totalCharge - faceValue;
  
  return Math.round(processingFee * 100);
}

/**
 * Calculate platform fee for Stripe Connect application_fee_amount
 * 
 * This is the fee that goes to the platform account in a Connect transaction.
 * Excludes Stripe's fees (which are automatically deducted by Stripe).
 * 
 * @param faceValueCents - Ticket face value in cents
 * @returns Platform fee in cents for Stripe Connect transfer_data
 */
export function calculatePlatformFeeCents(faceValueCents: number): number {
  // No platform fee on free tickets
  if (faceValueCents <= 0) return 0;
  
  const faceValue = faceValueCents / 100;
  const platformFeeTarget = faceValue * 0.066 + 1.79;
  
  return Math.round(platformFeeTarget * 100);
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
  const feesCents = calculateProcessingFeeCents(faceValueCents);
  const totalCents = faceValueCents + feesCents;
  const platformFeeCents = calculatePlatformFeeCents(faceValueCents);
  
  return {
    subtotalCents: faceValueCents,
    feesCents,
    totalCents,
    platformFeeCents, // For Stripe Connect application_fee_amount
    currency,
  };
}

/**
 * Build pricing snapshot for database storage
 * 
 * Converts camelCase pricing object to snake_case for Postgres
 */
export function buildPricingSnapshot(pricing: ReturnType<typeof buildPricingBreakdown>): Record<string, unknown> {
  return {
    subtotal_cents: pricing.subtotalCents,
    fees_cents: pricing.feesCents,
    total_cents: pricing.totalCents,
    currency: pricing.currency ?? "USD",
  };
}

