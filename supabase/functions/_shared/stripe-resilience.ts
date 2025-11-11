/**
 * Stripe API Resilience Utilities
 * 
 * Provides retry logic, circuit breaker patterns, and error handling
 * for all Stripe API interactions across Edge Functions.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/**
 * Custom error class for structured error handling
 */
export class StripeResilienceError extends Error {
  code?: string;
  status?: number;
  retryable: boolean;
  details?: unknown;

  constructor(message: string, options?: {
    code?: string;
    status?: number;
    retryable?: boolean;
    details?: unknown;
  }) {
    super(message);
    this.name = 'StripeResilienceError';
    this.code = options?.code;
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

/**
 * Determines if a Stripe error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network/connection errors - always retry
  if (
    error?.type === 'StripeConnectionError' ||
    error?.type === 'StripeAPIError' ||
    error?.code === 'ECONNRESET' ||
    error?.code === 'ETIMEDOUT' ||
    error?.code === 'ENOTFOUND' ||
    error?.code === 'EHOSTUNREACH'
  ) {
    return true;
  }

  // Rate limit errors - retry with backoff
  if (error?.statusCode === 429 || error?.type === 'StripeRateLimitError') {
    return true;
  }

  // Server errors (5xx) - retry
  if (error?.statusCode >= 500 && error?.statusCode < 600) {
    return true;
  }

  // Validation errors, auth errors, etc. - don't retry
  return false;
}

/**
 * Retry a Stripe API call with exponential backoff
 * 
 * @param fn - Function that returns a Promise (Stripe API call)
 * @param opts - Configuration options
 * @returns Result of the API call
 * 
 * @example
 * const balance = await retryStripeCall(
 *   () => stripe.balance.retrieve({ stripeAccount: accountId }),
 *   { operationName: 'balance.retrieve', maxRetries: 3 }
 * );
 */
export async function retryStripeCall<T>(
  fn: () => Promise<T>,
  opts: {
    operationName?: string;
    maxRetries?: number;
    baseBackoffMs?: number;
    maxBackoffMs?: number;
  } = {}
): Promise<T> {
  const operationName = opts.operationName || 'stripe_api_call';
  const maxRetries = opts.maxRetries ?? 3;
  const baseBackoffMs = opts.baseBackoffMs ?? 500;
  const maxBackoffMs = opts.maxBackoffMs ?? 5000;

  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const startTime = performance.now();
      const result = await fn();
      const duration = performance.now() - startTime;

      // Log successful call (but only if it took a while or was retried)
      if (attempt > 0 || duration > 1000) {
        console.log(`[stripe-resilience] ${operationName} succeeded`, {
          attempt: attempt + 1,
          duration_ms: Math.round(duration),
          retried: attempt > 0
        });
      }

      return result;
    } catch (err: any) {
      lastError = err;

      const isRetryable = isRetryableError(err);
      const isLastAttempt = attempt === maxRetries - 1;

      console.warn(`[stripe-resilience] ${operationName} failed`, {
        attempt: attempt + 1,
        max_retries: maxRetries,
        error_type: err?.type || err?.name,
        error_code: err?.code,
        status_code: err?.statusCode,
        retryable: isRetryable,
        message: err?.message
      });

      // Don't retry if error is not retryable
      if (!isRetryable) {
        throw new StripeResilienceError(
          err?.message || 'Stripe API call failed',
          {
            code: err?.code || err?.type,
            status: err?.statusCode,
            retryable: false,
            details: err
          }
        );
      }

      // Don't retry if this was the last attempt
      if (isLastAttempt) {
        throw new StripeResilienceError(
          `${operationName} failed after ${maxRetries} attempts: ${err?.message}`,
          {
            code: 'MAX_RETRIES_EXCEEDED',
            status: err?.statusCode,
            retryable: false,
            details: err
          }
        );
      }

      // Calculate backoff with exponential increase and jitter
      const exponentialBackoff = baseBackoffMs * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * exponentialBackoff; // 0-30% jitter
      const backoffMs = Math.min(exponentialBackoff + jitter, maxBackoffMs);

      console.log(`[stripe-resilience] Retrying ${operationName} in ${Math.round(backoffMs)}ms...`);

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Check circuit breaker status before making Stripe calls
 * 
 * @param supabaseClient - Supabase client with service role
 * @returns True if circuit is closed (safe to proceed)
 */
export async function checkStripeCircuitBreaker(
  supabaseClient: any
): Promise<boolean> {
  try {
    const { data } = await supabaseClient.rpc('check_circuit_breaker', {
      p_service_id: 'stripe_api',
    });

    if (!data?.can_proceed) {
      console.error('[stripe-resilience] Circuit breaker is OPEN - Stripe API calls blocked');
      return false;
    }

    return true;
  } catch (err) {
    // If circuit breaker check fails, log but allow the call to proceed
    // (fail open, not fail closed)
    console.warn('[stripe-resilience] Circuit breaker check failed, allowing request', err);
    return true;
  }
}

/**
 * Update circuit breaker state after a Stripe API call
 * 
 * @param supabaseClient - Supabase client with service role
 * @param success - Whether the call succeeded
 * @param errorMessage - Error message if call failed
 */
export async function updateStripeCircuitBreaker(
  supabaseClient: any,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await supabaseClient.rpc('update_circuit_breaker_state', {
      p_service_id: 'stripe_api',
      p_success: success,
      p_error_message: errorMessage || null
    });
  } catch (err) {
    // Non-critical - just log if circuit breaker update fails
    console.warn('[stripe-resilience] Failed to update circuit breaker state', err);
  }
}

/**
 * Wrapper that combines circuit breaker + retry logic
 * 
 * @example
 * const result = await stripeCallWithResilience(
 *   supabaseClient,
 *   () => stripe.checkout.sessions.create(config),
 *   { operationName: 'checkout.sessions.create' }
 * );
 */
export async function stripeCallWithResilience<T>(
  supabaseClient: any,
  fn: () => Promise<T>,
  opts: {
    operationName?: string;
    maxRetries?: number;
    skipCircuitBreaker?: boolean;
  } = {}
): Promise<T> {
  const operationName = opts.operationName || 'stripe_api_call';

  // Check circuit breaker (unless explicitly skipped)
  if (!opts.skipCircuitBreaker) {
    const canProceed = await checkStripeCircuitBreaker(supabaseClient);
    if (!canProceed) {
      throw new StripeResilienceError(
        'Stripe API is temporarily unavailable. Please try again shortly.',
        {
          code: 'STRIPE_CIRCUIT_OPEN',
          status: 503,
          retryable: true
        }
      );
    }
  }

  // Execute with retry logic
  try {
    const result = await retryStripeCall(fn, {
      operationName,
      maxRetries: opts.maxRetries
    });

    // Update circuit breaker on success
    await updateStripeCircuitBreaker(supabaseClient, true);

    return result;
  } catch (err) {
    // Update circuit breaker on failure
    await updateStripeCircuitBreaker(
      supabaseClient,
      false,
      err instanceof Error ? err.message : String(err)
    );

    throw err;
  }
}

