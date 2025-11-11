/**
 * Tests for Stripe resilience utilities
 */

import { assertEquals, assertRejects } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { retryStripeCall, StripeResilienceError } from "./stripe-resilience.ts";

Deno.test("retryStripeCall - succeeds on first attempt", async () => {
  let attempts = 0;
  
  const result = await retryStripeCall(
    async () => {
      attempts++;
      return "success";
    },
    { operationName: "test", maxRetries: 3 }
  );

  assertEquals(result, "success");
  assertEquals(attempts, 1);
});

Deno.test("retryStripeCall - retries on connection error", async () => {
  let attempts = 0;
  
  const result = await retryStripeCall(
    async () => {
      attempts++;
      if (attempts < 3) {
        const err: any = new Error("Connection failed");
        err.type = "StripeConnectionError";
        throw err;
      }
      return "success after retry";
    },
    { operationName: "test", maxRetries: 3, baseBackoffMs: 10 }
  );

  assertEquals(result, "success after retry");
  assertEquals(attempts, 3);
});

Deno.test("retryStripeCall - retries on 429 rate limit", async () => {
  let attempts = 0;
  
  const result = await retryStripeCall(
    async () => {
      attempts++;
      if (attempts === 1) {
        const err: any = new Error("Rate limit exceeded");
        err.statusCode = 429;
        err.type = "StripeRateLimitError";
        throw err;
      }
      return "success";
    },
    { operationName: "test", maxRetries: 3, baseBackoffMs: 10 }
  );

  assertEquals(result, "success");
  assertEquals(attempts, 2);
});

Deno.test("retryStripeCall - does not retry validation errors", async () => {
  let attempts = 0;
  
  await assertRejects(
    async () => {
      await retryStripeCall(
        async () => {
          attempts++;
          const err: any = new Error("Invalid parameter");
          err.type = "StripeInvalidRequestError";
          err.statusCode = 400;
          throw err;
        },
        { operationName: "test", maxRetries: 3 }
      );
    },
    StripeResilienceError,
    "Invalid parameter"
  );

  assertEquals(attempts, 1); // Only tried once
});

Deno.test("retryStripeCall - fails after max retries", async () => {
  let attempts = 0;
  
  await assertRejects(
    async () => {
      await retryStripeCall(
        async () => {
          attempts++;
          const err: any = new Error("Persistent connection error");
          err.type = "StripeConnectionError";
          throw err;
        },
        { operationName: "test", maxRetries: 3, baseBackoffMs: 10 }
      );
    },
    StripeResilienceError,
    "failed after 3 attempts"
  );

  assertEquals(attempts, 3);
});

Deno.test("retryStripeCall - respects max backoff", async () => {
  let attempts = 0;
  const startTime = Date.now();
  
  try {
    await retryStripeCall(
      async () => {
        attempts++;
        const err: any = new Error("Connection error");
        err.type = "StripeConnectionError";
        throw err;
      },
      {
        operationName: "test",
        maxRetries: 3,
        baseBackoffMs: 1000,
        maxBackoffMs: 100 // Cap at 100ms
      }
    );
  } catch {
    // Expected to fail
  }
  
  const duration = Date.now() - startTime;
  
  // With max backoff of 100ms and 2 retries, should be < 500ms total
  assertEquals(duration < 500, true, `Duration was ${duration}ms, expected < 500ms`);
});

