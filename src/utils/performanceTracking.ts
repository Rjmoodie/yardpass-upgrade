/**
 * Performance Tracking Utility
 * 
 * Provides lightweight performance measurement using the Performance API
 * and sends metrics to PostHog for analysis.
 * 
 * Usage:
 * 1. Call startTracking() at the beginning of an operation
 * 2. Call endTracking() when the operation completes
 * 3. Metrics are automatically sent to PostHog
 * 
 * @see PERF-001: Performance Tracking Infrastructure
 */

import { posthog } from 'posthog-js';

export interface PerformanceMetadata {
  itemCount?: number;
  eventCount?: number;
  userAgent?: 'mobile' | 'desktop';
  [key: string]: any;
}

/**
 * Start tracking performance for a given operation
 * @param operationName - Unique name for the operation (e.g., 'feed_load', 'dashboard_load')
 */
export function startTracking(operationName: string): void {
  const markName = `${operationName}_start`;
  
  try {
    performance.mark(markName);
  } catch (error) {
    console.warn(`Failed to start tracking for ${operationName}:`, error);
  }
}

/**
 * End tracking and send metrics to PostHog
 * @param operationName - Must match the name used in startTracking()
 * @param metadata - Additional metadata to include in the event
 */
export function endTracking(
  operationName: string, 
  metadata?: PerformanceMetadata
): number | null {
  const markStart = `${operationName}_start`;
  const markEnd = `${operationName}_end`;
  
  try {
    // Mark end time
    performance.mark(markEnd);
    
    // Measure duration
    const measure = performance.measure(operationName, markStart, markEnd);
    const duration = Math.round(measure.duration);
    
    // Detect device type
    const userAgent = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mobile')
      ? 'mobile'
      : 'desktop';
    
    // Send to PostHog
    posthog?.capture('perf_metric', {
      operation: operationName,
      duration_ms: duration,
      user_agent: metadata?.userAgent || userAgent,
      timestamp: new Date().toISOString(),
      ...metadata
    });
    
    // Log in development
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${operationName}: ${duration}ms`, metadata);
    }
    
    // Cleanup marks and measures
    performance.clearMarks(markStart);
    performance.clearMarks(markEnd);
    performance.clearMeasures(operationName);
    
    return duration;
  } catch (error) {
    console.warn(`Failed to end tracking for ${operationName}:`, error);
    return null;
  }
}

/**
 * Track a complete operation with automatic cleanup
 * Useful for wrapping async operations
 * 
 * @example
 * await trackOperation('feed_load', async () => {
 *   const data = await fetchFeed();
 *   return { itemCount: data.length };
 * });
 */
export async function trackOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  metadataFn?: (result: T) => PerformanceMetadata
): Promise<T> {
  startTracking(operationName);
  
  try {
    const result = await operation();
    const metadata = metadataFn ? metadataFn(result) : {};
    endTracking(operationName, metadata);
    return result;
  } catch (error) {
    // Still track failed operations
    endTracking(operationName, { error: true });
    throw error;
  }
}

/**
 * Track Web Vitals metrics (LCP, FID, CLS)
 * This is a Phase 2 enhancement - placeholder for now
 */
export function trackWebVitals(): void {
  // TODO: Implement in Phase 2
  // Will use 'web-vitals' library to track:
  // - Largest Contentful Paint (LCP)
  // - First Input Delay (FID)
  // - Cumulative Layout Shift (CLS)
}

/**
 * Helper to track database query duration from Edge Function response headers
 */
export function trackQueryDuration(
  operationName: string,
  headers: Headers,
  metadata?: PerformanceMetadata
): void {
  const queryDuration = headers.get('X-Query-Duration-Ms');
  
  if (queryDuration) {
    posthog?.capture('perf_query', {
      operation: operationName,
      query_duration_ms: parseInt(queryDuration, 10),
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }
}

