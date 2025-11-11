/**
 * Environment-aware logging utility
 * 
 * - Debug logs only appear in development
 * - Info/warn/error logs appear in all environments
 * - Prevents production console pollution
 * - Improves performance by eliminating unnecessary logging
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Debug logs - ONLY in development
   * Use for verbose debugging that shouldn't appear in production
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Info logs - All environments
   * Use for important user-facing events
   */
  info: (...args: any[]) => {
    console.log(...args);
  },

  /**
   * Warning logs - All environments
   * Use for recoverable errors or unexpected states
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Error logs - All environments
   * Use for actual errors that need attention
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Performance logs - ONLY in development
   * Use for timing/profiling information
   */
  perf: (label: string, duration: number) => {
    if (isDevelopment && duration > 16) {
      console.warn(`⚠️ [Perf] ${label} took ${duration.toFixed(2)}ms`);
    }
  },
};

/**
 * Performance monitoring helper
 * Automatically logs slow operations in development
 */
export function measurePerformance<T>(
  label: string,
  fn: () => T
): T {
  if (!isDevelopment) {
    return fn();
  }

  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  logger.perf(label, duration);
  
  return result;
}

/**
 * Async performance monitoring helper
 */
export async function measurePerformanceAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!isDevelopment) {
    return fn();
  }

  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  
  logger.perf(label, duration);
  
  return result;
}

