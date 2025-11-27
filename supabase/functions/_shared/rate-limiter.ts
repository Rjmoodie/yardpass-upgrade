/**
 * Shared Rate Limiter
 * 
 * Provides rate limiting using database-backed counters.
 * Used by: Checkout endpoints, email sends, push notifications
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export interface RateLimitResult {
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
    const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
    
    const { data: newCounter, error: insertError } = await supabaseClient
      .from('rate_limit_counters')
      .upsert({
        key,
        count: 1,
        window_start: now.toISOString(),
        window_end: windowEnd.toISOString(),
        updated_at: now.toISOString(),
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
    // If function doesn't exist yet, fallback to manual increment
    if (updateError.code === '42883') {
      const { data: manualUpdate, error: manualError } = await supabaseClient
        .from('rate_limit_counters')
        .update({ 
          count: counter.count + 1,
          updated_at: now.toISOString(),
        })
        .eq('key', key)
        .eq('count', counter.count) // Optimistic locking
        .select('count')
        .single();

      if (manualError || !manualUpdate) {
        // Race condition - fetch fresh value
        const { data: fresh } = await supabaseClient
          .from('rate_limit_counters')
          .select('count, window_end')
          .eq('key', key)
          .single();

        const count = fresh?.count || counter.count;
        const resetAt = fresh?.window_end ? new Date(fresh.window_end) : new Date(counter.window_end);

        return {
          allowed: count < limit,
          remaining: Math.max(0, limit - count),
          resetAt,
          limit,
        };
      }

      const resetAt = new Date(counter.window_end);
      return {
        allowed: manualUpdate.count <= limit,
        remaining: Math.max(0, limit - manualUpdate.count),
        resetAt,
        limit,
      };
    }

    throw new Error(`Rate limit increment failed: ${updateError.message}`);
  }

  const resetAt = new Date(counter.window_end);
  const count = updated?.count || counter.count + 1;
  const remaining = Math.max(0, limit - count);

  return {
    allowed: count <= limit,
    remaining,
    resetAt,
    limit,
  };
}

