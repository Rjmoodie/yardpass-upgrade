/**
 * Shared Retry Utilities
 * 
 * Provides retry logic with exponential backoff for all Edge Functions.
 * Used by: Email sends, webhook processing, push notifications, Stripe calls
 */

export interface RetryOptions {
  operationName: string;
  maxRetries?: number;
  backoffSchedule?: number[]; // Milliseconds between retries
  retryable?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

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
  options: RetryOptions
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
  options: RetryOptions
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

