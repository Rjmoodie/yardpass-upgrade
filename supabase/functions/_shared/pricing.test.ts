/**
 * Tests for pricing utility functions
 * 
 * Run with: deno test --allow-read supabase/functions/_shared/pricing.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import {
  calculateProcessingFeeCents,
  calculatePlatformFeeCents,
  buildPricingBreakdown,
} from "./pricing.ts";

Deno.test("calculateProcessingFeeCents - free tickets have no fees", () => {
  assertEquals(calculateProcessingFeeCents(0), 0);
  assertEquals(calculateProcessingFeeCents(-100), 0);
});

Deno.test("calculateProcessingFeeCents - $10 ticket", () => {
  const fee = calculateProcessingFeeCents(1000);
  // Expected: ~$3.50 ($10 * 6.6% + $1.79, grossed up for Stripe)
  // Actual calculation: ((10 + 10*0.066 + 1.79) + 0.30) / 0.971 - 10 ≈ 3.47
  assertEquals(fee >= 340 && fee <= 360, true, `Expected ~350, got ${fee}`);
});

Deno.test("calculateProcessingFeeCents - $100 ticket", () => {
  const fee = calculateProcessingFeeCents(10000);
  // Expected: ~$24.50 ($100 * 6.6% + $1.79, grossed up)
  // Actual: ((100 + 100*0.066 + 1.79) + 0.30) / 0.971 - 100 ≈ 24.46
  assertEquals(fee >= 2400 && fee <= 2500, true, `Expected ~2450, got ${fee}`);
});

Deno.test("calculateProcessingFeeCents - $1000 ticket", () => {
  const fee = calculateProcessingFeeCents(100000);
  // Expected: ~$188 ($1000 * 6.6% + $1.79, grossed up)
  assertEquals(fee >= 18700 && fee <= 18900, true, `Expected ~18800, got ${fee}`);
});

Deno.test("calculateProcessingFeeCents - $0.01 ticket (edge case)", () => {
  const fee = calculateProcessingFeeCents(1);
  // Even tiny tickets get the base $1.79 fee
  assertEquals(fee >= 180 && fee <= 200, true, `Expected ~190, got ${fee}`);
});

Deno.test("calculatePlatformFeeCents - returns just platform portion", () => {
  const platformFee = calculatePlatformFeeCents(1000);
  const processingFee = calculateProcessingFeeCents(1000);
  
  // Platform fee should be less than total processing fee
  // (because processing fee includes gross-up for Stripe)
  assertEquals(platformFee < processingFee, true);
  
  // For $10 ticket: 10 * 0.066 + 1.79 = 2.45 = 245 cents
  assertEquals(platformFee >= 240 && platformFee <= 250, true);
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

