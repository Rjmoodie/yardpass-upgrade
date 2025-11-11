/**
 * Feature Flags Configuration
 * 
 * Centralized feature flag management for gradual rollouts and A/B testing.
 * 
 * Usage:
 * import { featureFlags } from '@/config/featureFlags';
 * 
 * if (featureFlags.messaging.enabled) {
 *   // Show messaging UI
 * }
 */

interface FeatureFlag {
  enabled: boolean;
  description: string;
  rolloutPercent?: number; // Future: gradual rollout 0-100
}

interface FeatureFlags {
  messaging: FeatureFlag & {
    rateLimitEnabled: boolean; // Enable 200 msg/hour limit
  };
  socialGraph: FeatureFlag & {
    blocking: boolean;
    privateAccounts: boolean;
  };
  // Add more features as needed
}

/**
 * Check if feature is enabled via environment variable override.
 * Useful for testing in development.
 * 
 * @example
 * localStorage.setItem('feature_messaging', 'true');
 */
function isFeatureEnabledLocally(featureName: string): boolean | null {
  if (typeof window === 'undefined') return null;
  
  const localFlag = localStorage.getItem(`feature_${featureName}`);
  if (localFlag === 'true') return true;
  if (localFlag === 'false') return false;
  return null;
}

/**
 * Main feature flags configuration.
 * 
 * HOW TO ENABLE A FEATURE:
 * 1. Change `enabled: false` to `enabled: true`
 * 2. Deploy code
 * 3. Test in staging
 * 4. Roll out to production
 * 
 * OR for local testing:
 * localStorage.setItem('feature_messaging', 'true');
 */
export const featureFlags: FeatureFlags = {
  /**
   * Direct Messaging System
   * 
   * Status: Backend deployed, frontend ready
   * Required: Database migration 20251111000001_create_messaging_system.sql must be applied
   * 
   * Rollout Plan:
   * - Phase 1: Internal testing (set enabled: true locally)
   * - Phase 2: Beta users (enable via feature flag)
   * - Phase 3: General availability
   */
  messaging: {
    enabled: isFeatureEnabledLocally('messaging') ?? true, // ✅ ENABLED
    description: 'Direct messaging between users and organizers',
    rateLimitEnabled: false, // Enable if spam/abuse occurs
  },

  /**
   * Social Graph Features
   * 
   * Status: Fully deployed and active
   * Required: Migration 20251111000000_add_follow_safety_layer.sql applied
   */
  socialGraph: {
    enabled: true,
    description: 'Following system for users, organizers, and events',
    blocking: isFeatureEnabledLocally('blocking') ?? true, // ✅ Live
    privateAccounts: isFeatureEnabledLocally('privateAccounts') ?? true, // ✅ Live
  },
};

/**
 * Helper: Check if a feature is enabled.
 * Centralizes feature flag logic including local overrides.
 * 
 * @example
 * if (isFeatureEnabled('messaging')) {
 *   // Show messaging button
 * }
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const localOverride = isFeatureEnabledLocally(feature);
  if (localOverride !== null) return localOverride;
  
  return featureFlags[feature]?.enabled ?? false;
}

/**
 * Helper: Check if a nested feature flag is enabled.
 * 
 * @example
 * if (isNestedFeatureEnabled('socialGraph', 'blocking')) {
 *   // Show block button
 * }
 */
export function isNestedFeatureEnabled(
  parent: keyof FeatureFlags,
  child: string
): boolean {
  const localOverride = isFeatureEnabledLocally(`${parent}_${child}`);
  if (localOverride !== null) return localOverride;
  
  const parentFlag = featureFlags[parent];
  if (!parentFlag?.enabled) return false;
  
  return (parentFlag as any)[child] ?? false;
}

/**
 * HOW TO TEST A FEATURE LOCALLY:
 * 
 * 1. Open browser console
 * 2. Run: localStorage.setItem('feature_messaging', 'true')
 * 3. Refresh page
 * 4. Feature is now enabled!
 * 
 * To disable:
 * localStorage.removeItem('feature_messaging')
 * 
 * To see all local overrides:
 * Object.keys(localStorage).filter(k => k.startsWith('feature_'))
 */

