/**
 * Tests for pricing utility functions
 * 
 * Run with: deno test --allow-read supabase/functions/_shared/pricing.test.ts
 * 
 * Fee Structure (Eventbrite-equivalent):
 *   Platform Fee = 3.7% + $1.79 per ticket
 *   Stripe Fee = 2.9% + $0.30 per transaction
 */

import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  calculateProcessingFeeCents,
  calculatePlatformFeeCents,
  buildPricingBreakdown,
  calculateGrossedUpCharge,
  PLATFORM_PERCENT,
  PLATFORM_FLAT,
} from "./pricing.ts";

Deno.test("Constants are set correctly", () => {
  assertEquals(PLATFORM_PERCENT, 0.037, "Platform percent should be 3.7%");
  assertEquals(PLATFORM_FLAT, 1.79, "Platform flat fee should be $1.79");
});

Deno.test("calculateProcessingFeeCents - free tickets have no fees", () => {
  assertEquals(calculateProcessingFeeCents(0), 0);
  assertEquals(calculateProcessingFeeCents(-100), 0);
});

Deno.test("calculateProcessingFeeCents - $10 ticket", () => {
  const fee = calculateProcessingFeeCents(1000);
  // Expected: ($10 * 3.7% + $1.79, grossed up for Stripe)
  // Platform fee: 10 * 0.037 + 1.79 = $2.16
  // Grossed up: (10 + 2.16 + 0.30) / 0.971 = $12.83
  // Processing fee: 12.83 - 10 = $2.83 = ~283 cents
  assertEquals(fee >= 275 && fee <= 295, true, `Expected ~283, got ${fee}`);
});

Deno.test("calculateProcessingFeeCents - $100 ticket", () => {
  const fee = calculateProcessingFeeCents(10000);
  // Expected: ($100 * 3.7% + $1.79, grossed up)
  // Platform fee: 100 * 0.037 + 1.79 = $5.49
  // Grossed up: (100 + 5.49 + 0.30) / 0.971 = $108.95
  // Processing fee: 108.95 - 100 = $8.95 = ~895 cents
  assertEquals(fee >= 885 && fee <= 905, true, `Expected ~895, got ${fee}`);
});

Deno.test("calculateProcessingFeeCents - $1000 ticket", () => {
  const fee = calculateProcessingFeeCents(100000);
  // Expected: ($1000 * 3.7% + $1.79, grossed up)
  // Platform fee: 1000 * 0.037 + 1.79 = $38.79
  // Processing fee: ~$70.12 = ~7012 cents
  assertEquals(fee >= 6950 && fee <= 7100, true, `Expected ~7012, got ${fee}`);
});

Deno.test("calculateProcessingFeeCents - $0.01 ticket (edge case)", () => {
  const fee = calculateProcessingFeeCents(1);
  // Even tiny tickets get the base $1.79 fee + gross-up
  // ~$2.15 processing fee = ~215 cents
  assertEquals(fee >= 200 && fee <= 230, true, `Expected ~215, got ${fee}`);
});

Deno.test("calculatePlatformFeeCents - returns just platform portion", () => {
  const platformFee = calculatePlatformFeeCents(1000);
  const processingFee = calculateProcessingFeeCents(1000);
  
  // Platform fee should be less than total processing fee
  // (because processing fee includes gross-up for Stripe)
  assertEquals(platformFee < processingFee, true);
  
  // For $10 ticket: 10 * 0.037 + 1.79 = 2.16 = ~216 cents
  assertEquals(platformFee >= 210 && platformFee <= 220, true, `Expected ~216, got ${platformFee}`);
});

Deno.test("calculateGrossedUpCharge - $100 ticket breakdown", () => {
  const result = calculateGrossedUpCharge(100);
  
  // Buyer should pay ~$108.95
  assertEquals(result.buyerTotal >= 108.90 && result.buyerTotal <= 109.00, true, 
    `Expected buyerTotal ~108.95, got ${result.buyerTotal}`);
  
  // Platform fee should be ~$5.49
  assertEquals(result.platformFee >= 5.45 && result.platformFee <= 5.55, true,
    `Expected platformFee ~5.49, got ${result.platformFee}`);
  
  // Organizer should get ~$100
  assertEquals(result.organizerPayout >= 99.90 && result.organizerPayout <= 100.10, true,
    `Expected organizerPayout ~100, got ${result.organizerPayout}`);
});

Deno.test("buildPricingBreakdown - complete structure", () => {
  const pricing = buildPricingBreakdown(5000, "USD"); // $50 ticket
  
  assertEquals(pricing.subtotalCents, 5000);
  assertEquals(pricing.currency, "USD");
  assertEquals(typeof pricing.feesCents, "number");
  assertEquals(typeof pricing.totalCents, "number");
  assertEquals(typeof pricing.platformFeeCents, "number");
  
  // Total = subtotal + fees
  assertEquals(pricing.totalCents, pricing.subtotalCents + pricing.feesCents);
  
  // Platform fee should be less than processing fee
  assertEquals(pricing.platformFeeCents < pricing.feesCents, true);
});

Deno.test("buildPricingBreakdown - free ticket", () => {
  const pricing = buildPricingBreakdown(0);
  
  assertEquals(pricing.subtotalCents, 0);
  assertEquals(pricing.feesCents, 0);
  assertEquals(pricing.totalCents, 0);
  assertEquals(pricing.platformFeeCents, 0);
});

Deno.test("Fee consistency - same input always produces same output", () => {
  // Critical for idempotency
  const amount = 2500; // $25
  
  const fee1 = calculateProcessingFeeCents(amount);
  const fee2 = calculateProcessingFeeCents(amount);
  const fee3 = calculateProcessingFeeCents(amount);
  
  assertEquals(fee1, fee2);
  assertEquals(fee2, fee3);
});

Deno.test("buildPricingBreakdown - defaults to USD", () => {
  const pricing = buildPricingBreakdown(1000);
  assertEquals(pricing.currency, "USD");
});

Deno.test("buildPricingBreakdown - accepts custom currency", () => {
  const pricing = buildPricingBreakdown(1000, "EUR");
  assertEquals(pricing.currency, "EUR");
});

Deno.test("Organizer payout verification - ensures organizer gets face value", () => {
  // Test across various ticket prices
  const testPrices = [20, 50, 100, 200, 500];
  
  for (const price of testPrices) {
    const result = calculateGrossedUpCharge(price);
    // Organizer should receive within 20 cents of face value (accounting for rounding)
    const diff = Math.abs(result.organizerPayout - price);
    assertEquals(diff <= 0.20, true, 
      `For $${price} ticket, organizer got $${result.organizerPayout} (diff: $${diff})`);
  }
});
