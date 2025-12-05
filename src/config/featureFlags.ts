/**
 * Feature Flags Configuration
 * 
 * Centralized feature flag management for gradual rollouts and A/B testing.
 * Uses PostHog for flag evaluation (or falls back to local overrides in dev).
 * 
 * @example
 * ```typescript
 * import { isFeatureEnabled } from '@/config/featureFlags';
 * 
 * if (isFeatureEnabled('feed.optimistic-posting')) {
 *   // Use new optimized path
 * } else {
 *   // Use old path
 * }
 * ```
 */

import posthog from 'posthog-js';

export interface FeatureFlags {
  // Feed optimizations
  'feed.optimistic-posting': boolean;
  'feed.realtime-posts': boolean;
  'feed.background-revalidation': boolean;
  'feed.processing-indicators': boolean;
  
  // Other feature flags (add as needed)
  // 'messaging.realtime': boolean;
  // 'events.ai-recommendations': boolean;
}

/**
 * Local overrides for development
 * Set localStorage.setItem('featureFlags', JSON.stringify({ ... }))
 */
function getLocalOverrides(): Partial<FeatureFlags> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem('featureFlags');
    if (stored) {
      return JSON.parse(stored) as Partial<FeatureFlags>;
    }
  } catch (error) {
    console.warn('[FeatureFlags] Failed to parse local overrides:', error);
  }
  
  return {};
}

/**
 * Check if a feature is enabled for the current user
 * 
 * Priority:
 * 1. Local overrides (dev only)
 * 2. PostHog remote flags
 * 3. Default value (false)
 * 
 * @param flag - Feature flag key
 * @param userId - Optional user ID for targeting
 * @returns true if feature is enabled
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const optimisticEnabled = isFeatureEnabled('feed.optimistic-posting');
 * 
 * // With user ID for targeting
 * const realtimeEnabled = isFeatureEnabled('feed.realtime-posts', user?.id);
 * ```
 */
export function isFeatureEnabled(
  flag: keyof FeatureFlags,
  userId?: string
): boolean {
  // Development: Check local overrides first
  if (import.meta.env.DEV) {
    const overrides = getLocalOverrides();
    if (flag in overrides) {
      const enabled = overrides[flag] ?? false;
      console.log(`[FeatureFlags] ${flag}: ${enabled ? 'ON' : 'OFF'} (local override)`);
      return enabled;
    }
  }

  // Production: Check PostHog
  try {
    const enabled = posthog.isFeatureEnabled(flag);
    
    if (import.meta.env.DEV) {
      console.log(`[FeatureFlags] ${flag}: ${enabled ? 'ON' : 'OFF'}`, { userId });
    }
    
    return enabled ?? false;
  } catch (error) {
    console.warn(`[FeatureFlags] Failed to check flag ${flag}:`, error);
    return false;
  }
}

/**
 * Get feature flag variant for A/B testing
 * 
 * @param flag - Feature flag key
 * @returns variant string or boolean
 * 
 * @example
 * ```typescript
 * const variant = getFeatureVariant('feed.algorithm');
 * if (variant === 'chronological') {
 *   // Show chronological feed
 * } else if (variant === 'ai-ranked') {
 *   // Show AI-ranked feed
 * }
 * ```
 */
export function getFeatureVariant(
  flag: keyof FeatureFlags
): string | boolean {
  try {
    return posthog.getFeatureFlag(flag);
  } catch (error) {
    console.warn(`[FeatureFlags] Failed to get variant for ${flag}:`, error);
    return false;
  }
}

/**
 * Enable a feature flag locally (dev only)
 * 
 * @param flag - Feature flag key
 * @param enabled - Enable or disable
 * 
 * @example
 * ```typescript
 * // In browser console or dev tools
 * import { setLocalFeatureFlag } from '@/config/featureFlags';
 * setLocalFeatureFlag('feed.optimistic-posting', true);
 * ```
 */
export function setLocalFeatureFlag(
  flag: keyof FeatureFlags,
  enabled: boolean
): void {
  if (!import.meta.env.DEV) {
    console.warn('[FeatureFlags] Local overrides only available in development');
    return;
  }

  const overrides = getLocalOverrides();
  overrides[flag] = enabled;
  
  try {
    localStorage.setItem('featureFlags', JSON.stringify(overrides));
    console.log(`[FeatureFlags] Set ${flag} = ${enabled} (local override)`);
  } catch (error) {
    console.error('[FeatureFlags] Failed to save local override:', error);
  }
}

/**
 * Clear all local feature flag overrides
 */
export function clearLocalFeatureFlags(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem('featureFlags');
    console.log('[FeatureFlags] Cleared all local overrides');
  } catch (error) {
    console.error('[FeatureFlags] Failed to clear overrides:', error);
  }
}

/**
 * Get all feature flags and their current values
 * Useful for debugging and admin dashboards
 */
export function getAllFeatureFlags(): Record<keyof FeatureFlags, boolean> {
  const flags: Partial<Record<keyof FeatureFlags, boolean>> = {};
  
  const flagKeys: Array<keyof FeatureFlags> = [
    'feed.optimistic-posting',
    'feed.realtime-posts',
    'feed.background-revalidation',
    'feed.processing-indicators',
  ];
  
  for (const flag of flagKeys) {
    flags[flag] = isFeatureEnabled(flag);
  }
  
  return flags as Record<keyof FeatureFlags, boolean>;
}

// Expose to window for debugging (dev only)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__featureFlags = {
    isEnabled: isFeatureEnabled,
    getVariant: getFeatureVariant,
    setLocal: setLocalFeatureFlag,
    clearLocal: clearLocalFeatureFlags,
    getAll: getAllFeatureFlags,
  };
  
  console.log('💡 Feature flags available via window.__featureFlags');
}
