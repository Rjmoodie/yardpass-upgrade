# 🛠️ Shared Resilience Primitives

**Date:** January 28, 2025  
**Purpose:** Reusable utilities for retry, queue, rate limiting, and logging  
**Location:** `supabase/functions/_shared/`

---

## 📦 Overview

To avoid reinventing retry/queue/rate-limit logic per feature, we establish shared primitives that all Edge Functions can use.

---

## 1. Retry Utility

**File:** `supabase/functions/_shared/retry-utils.ts`

```typescript
/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Function to retry (must return Promise)
 * @param options - Configuration options
 * @returns Result of the function
 * @throws Last error if all retries fail
 * 
 * @example
 * const result = await retryWithBackoff(
 *   () => fetch('https://api.example.com/data'),
 *   {
 *     operationName: 'fetch_data',
 *     maxRetries: 3,
 *     backoffSchedule: [1000, 5000, 30000],
 *     retryable: (error) => error.status >= 500 || error.code === 'ETIMEDOUT'
 *   }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    operationName: string;
    maxRetries?: number;
    backoffSchedule?: number[]; // Milliseconds between retries
    retryable?: (error: any) => boolean;
    onRetry?: (attempt: number, error: any) => void;
  }
): Promise<T> {
  const {
    operationName,
    maxRetries = 3,
    backoffSchedule = [1000, 5000, 30000], // 1s, 5s, 30s
    retryable = (error: any) => {
      // Default: retry on network errors and 5xx
      if (error?.status >= 500) return true;
      if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNRESET') return true;
      if (error?.type === 'network' || error?.type === 'timeout') return true;
      return false;
    },
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = performance.now();
      const result = await fn();
      const duration = performance.now() - startTime;

      // Log if retried or slow
      if (attempt > 0 || duration > 1000) {
        console.log(`[retry] ${operationName} succeeded`, {
          attempt: attempt + 1,
          duration: `${duration.toFixed(2)}ms`,
        });
      }

      return result;
    } catch (error: any) {
      lastError = error;

      // Don't retry if not retryable or last attempt
      if (!retryable(error) || attempt === maxRetries) {
        if (attempt > 0) {
          console.error(`[retry] ${operationName} failed after ${attempt + 1} attempts:`, error);
        }
        throw error;
      }

      // Schedule retry with backoff
      const delay = backoffSchedule[Math.min(attempt, backoffSchedule.length - 1)] || 30000;
      
      if (onRetry) {
        onRetry(attempt + 1, error);
      } else {
        console.warn(`[retry] ${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Retry with jitter (randomized backoff to prevent thundering herd)
 */
export async function retryWithBackoffAndJitter<T>(
  fn: () => Promise<T>,
  options: Parameters<typeof retryWithBackoff<T>>[1]
): Promise<T> {
  // Add jitter (±20%) to backoff schedule
  const jitteredSchedule = options.backoffSchedule?.map(delay => {
    const jitter = delay * 0.2 * (Math.random() - 0.5); // ±20%
    return Math.max(100, delay + jitter);
  });

  return retryWithBackoff(fn, {
    ...options,
    backoffSchedule: jitteredSchedule || options.backoffSchedule,
  });
}
```

---

## 2. Queue Utility

**File:** `supabase/functions/_shared/queue-utils.ts`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/**
 * Enqueue an item into a retry queue with dead letter support
 * 
 * @param supabaseClient - Supabase service client
 * @param queueTable - Table name (e.g., 'email_queue', 'webhook_retry_queue')
 * @param item - Item to enqueue
 * @param options - Configuration
 * @returns Queue item ID
 */
export async function enqueueWithDLQ(
  supabaseClient: any,
  queueTable: 'email_queue' | 'webhook_retry_queue',
  item: Record<string, unknown>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<string> {
  const {
    maxAttempts = 5,
    initialDelayMs = 0,
    metadata = {},
  } = options;

  // Calculate initial retry time
  const nextRetryAt = initialDelayMs > 0
    ? new Date(Date.now() + initialDelayMs).toISOString()
    : new Date().toISOString();

  const { data, error } = await supabaseClient
    .from(queueTable)
    .insert({
      ...item,
      max_attempts: maxAttempts,
      status: 'pending',
      next_retry_at: nextRetryAt,
      attempts: 0,
      metadata: {
        ...metadata,
        enqueued_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to enqueue item: ${error.message}`);
  }

  return data.id;
}

/**
 * Mark queue item as processed
 */
export async function markQueueItemProcessed(
  supabaseClient: any,
  queueTable: 'email_queue' | 'webhook_retry_queue',
  itemId: string
): Promise<void> {
  const processedField = queueTable === 'email_queue' ? 'sent_at' : 'processed_at';
  
  const { error } = await supabaseClient
    .from(queueTable)
    .update({
      status: 'processed',
      [processedField]: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) {
    throw new Error(`Failed to mark item as processed: ${error.message}`);
  }
}

/**
 * Mark queue item as failed and schedule retry
 */
export async function markQueueItemFailed(
  supabaseClient: any,
  queueTable: 'email_queue' | 'webhook_retry_queue',
  itemId: string,
  errorMessage: string
): Promise<void> {
  // Get current attempt count
  const { data: current, error: fetchError } = await supabaseClient
    .from(queueTable)
    .select('attempts, max_attempts')
    .eq('id', itemId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch item: ${fetchError.message}`);
  }

  const newAttempts = (current.attempts || 0) + 1;
  const maxAttempts = current.max_attempts || 5;

  // Calculate retry time based on queue type
  const retryFunction = queueTable === 'email_queue'
    ? 'calculate_email_retry_time'
    : 'calculate_webhook_retry_time';

  if (newAttempts >= maxAttempts) {
    // Move to dead letter
    const { error } = await supabaseClient
      .from(queueTable)
      .update({
        status: 'dead_letter',
        last_error: errorMessage,
        error_count: newAttempts,
        failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (error) {
      throw new Error(`Failed to mark item as dead letter: ${error.message}`);
    }
  } else {
    // Schedule retry
    const { data: retryTime, error: retryError } = await supabaseClient
      .rpc(retryFunction, { attempt_number: newAttempts - 1 });

    if (retryError) {
      throw new Error(`Failed to calculate retry time: ${retryError.message}`);
    }

    const { error } = await supabaseClient
      .from(queueTable)
      .update({
        status: 'pending',
        attempts: newAttempts,
        error_count: newAttempts,
        last_error: errorMessage,
        next_retry_at: retryTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (error) {
      throw new Error(`Failed to schedule retry: ${error.message}`);
    }
  }
}
```

---

## 3. Rate Limiter

**File:** `supabase/functions/_shared/rate-limiter.ts`

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Check if an operation is within rate limits
 * 
 * Uses database table for rate limit tracking
 * 
 * @param supabaseClient - Supabase service client
 * @param key - Rate limit key (e.g., 'email:global', 'checkout:user:123')
 * @param limit - Maximum number of operations
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  supabaseClient: any,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowSeconds * 1000);

  // Get or create rate limit counter
  const { data: counter, error: fetchError } = await supabaseClient
    .from('rate_limit_counters')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') { // Not found is OK
    throw new Error(`Rate limit check failed: ${fetchError.message}`);
  }

  // Initialize or reset if window expired
  if (!counter || new Date(counter.window_start) < windowStart) {
    const { data: newCounter, error: insertError } = await supabaseClient
      .from('rate_limit_counters')
      .upsert({
        key,
        count: 1,
        window_start: now.toISOString(),
        window_end: new Date(now.getTime() + windowSeconds * 1000).toISOString(),
      }, {
        onConflict: 'key',
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Rate limit initialization failed: ${insertError.message}`);
    }

    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: new Date(newCounter.window_end),
      limit,
    };
  }

  // Increment counter atomically
  const { data: updated, error: updateError } = await supabaseClient
    .rpc('increment_rate_limit', {
      p_key: key,
      p_increment: 1,
      p_limit: limit,
    })
    .single();

  if (updateError) {
    throw new Error(`Rate limit increment failed: ${updateError.message}`);
  }

  const resetAt = new Date(counter.window_end);
  const remaining = Math.max(0, limit - updated.count);

  return {
    allowed: updated.count <= limit,
    remaining,
    resetAt,
    limit,
  };
}

/**
 * Rate limit counter increment RPC (atomic)
 * 
 * Must be created in database:
 * 
 * CREATE OR REPLACE FUNCTION increment_rate_limit(
 *   p_key TEXT,
 *   p_increment INT,
 *   p_limit INT
 * ) RETURNS TABLE(count INT)
 * LANGUAGE plpgsql
 * AS $$
 * BEGIN
 *   UPDATE rate_limit_counters
 *   SET count = count + p_increment
 *   WHERE key = p_key
 *     AND count < p_limit;
 *   
 *   RETURN QUERY
 *   SELECT rate_limit_counters.count
 *   FROM rate_limit_counters
 *   WHERE key = p_key;
 * END;
 * $$;
 */
```

**Required Database Table:**
```sql
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key TEXT PRIMARY KEY,
  count INT DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window_end 
ON rate_limit_counters(window_end) 
WHERE window_end < now(); -- For cleanup
```

---

## 4. Standard Logger

**File:** `supabase/functions/_shared/logger.ts`

```typescript
/**
 * Standard logging with context
 * 
 * Attaches request ID, user ID, feature name to all logs
 * for better observability
 */
export interface LogContext {
  feature: string;
  requestId?: string;
  userId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export function logWithContext(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  context: LogContext
): void {
  const logEntry = {
    level,
    message,
    feature: context.feature,
    requestId: context.requestId || generateRequestId(),
    userId: context.userId,
    operation: context.operation,
    timestamp: new Date().toISOString(),
    ...context.metadata,
  };

  const logString = JSON.stringify(logEntry);

  switch (level) {
    case 'error':
      console.error(logString);
      break;
    case 'warn':
      console.warn(logString);
      break;
    case 'debug':
      if (Deno.env.get('DEBUG') === 'true') {
        console.debug(logString);
      }
      break;
    default:
      console.log(logString);
  }
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a scoped logger for a specific feature
 */
export function createScopedLogger(feature: string, baseContext?: Partial<LogContext>) {
  return {
    info: (message: string, metadata?: Record<string, unknown>) => {
      logWithContext('info', message, {
        feature,
        ...baseContext,
        metadata: { ...baseContext?.metadata, ...metadata },
      });
    },
    warn: (message: string, metadata?: Record<string, unknown>) => {
      logWithContext('warn', message, {
        feature,
        ...baseContext,
        metadata: { ...baseContext?.metadata, ...metadata },
      });
    },
    error: (message: string, error?: Error, metadata?: Record<string, unknown>) => {
      logWithContext('error', message, {
        feature,
        ...baseContext,
        metadata: {
          ...baseContext?.metadata,
          ...metadata,
          error: error?.message,
          stack: error?.stack,
        },
      });
    },
    debug: (message: string, metadata?: Record<string, unknown>) => {
      logWithContext('debug', message, {
        feature,
        ...baseContext,
        metadata: { ...baseContext?.metadata, ...metadata },
      });
    },
  };
}

/**
 * Usage example:
 * 
 * const logger = createScopedLogger('stripe', { userId: user.id });
 * logger.info('Payment intent created', { orderId: order.id });
 * logger.error('Payment failed', error, { orderId: order.id });
 */
```

---

## 📋 Migration for Shared Primitives

**File:** `supabase/migrations/20250128_create_shared_primitives.sql`

```sql
-- Rate limit counter table (for shared rate limiter)
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key TEXT PRIMARY KEY,
  count INT DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window_end 
ON public.rate_limit_counters(window_end) 
WHERE window_end < now();

-- Atomic increment function
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_key TEXT,
  p_increment INT,
  p_limit INT
)
RETURNS TABLE(count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rate_limit_counters
  SET count = count + p_increment,
      updated_at = now()
  WHERE key = p_key
    AND window_end > now(); -- Only increment if window is still valid
  
  RETURN QUERY
  SELECT rate_limit_counters.count
  FROM rate_limit_counters
  WHERE key = p_key;
  
  -- If no row exists, return 0
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::INT;
  END IF;
END;
$$;

-- Cleanup job for expired counters (run via pg_cron)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limit_counters
  WHERE window_end < now() - INTERVAL '1 hour'; -- Keep for 1 hour after expiry
END;
$$;
```

---

## ✅ Usage Checklist

- [ ] Create shared primitives directory: `supabase/functions/_shared/`
- [ ] Implement `retry-utils.ts`
- [ ] Implement `queue-utils.ts`
- [ ] Implement `rate-limiter.ts`
- [ ] Implement `logger.ts`
- [ ] Create database migration for rate limit counters
- [ ] Update all Edge Functions to use shared primitives
- [ ] Document usage in each function

---

**Once shared primitives are in place, all feature hardening tasks reference them!**

