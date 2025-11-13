/**
 * Feature Flags for Controlled Rollout
 * 
 * Enables gradual rollout of new features with kill switches
 */

export interface FeatureFlags {
  // Analytics
  useInternalAudienceAnalytics: boolean;
  enableLeakyStepAnalysis: boolean;
  enableCreativeDiagnostics: boolean;
  enableAnomalyDetection: boolean;
  
  // Performance
  useMaterializedViews: boolean;
  useQueryCache: boolean;
  
  // Attribution
  enableIdentityStitching: boolean;
  multiTouchAttribution: boolean;
}

// Default feature flags
const DEFAULT_FLAGS: FeatureFlags = {
  // Analytics - start with internal enabled
  useInternalAudienceAnalytics: true,
  enableLeakyStepAnalysis: true,
  enableCreativeDiagnostics: true,
  enableAnomalyDetection: false,  // Can enable later
  
  // Performance - all enabled
  useMaterializedViews: true,
  useQueryCache: true,
  
  // Attribution - all enabled
  enableIdentityStitching: true,
  multiTouchAttribution: true,
};

// Get feature flags from localStorage or defaults
export function getFeatureFlags(): FeatureFlags {
  try {
    const stored = localStorage.getItem('liventix_feature_flags');
    if (stored) {
      return { ...DEFAULT_FLAGS, ...JSON.parse(stored) };
    }
  } catch (err) {
    console.error('Failed to parse feature flags from localStorage:', err);
  }
  
  return DEFAULT_FLAGS;
}

// Update specific feature flag
export function setFeatureFlag(flag: keyof FeatureFlags, value: boolean) {
  const current = getFeatureFlags();
  const updated = { ...current, [flag]: value };
  
  try {
    localStorage.setItem('liventix_feature_flags', JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save feature flag:', err);
  }
}

// Check if specific feature is enabled
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag];
}

// Reset all flags to defaults
export function resetFeatureFlags() {
  try {
    localStorage.removeItem('liventix_feature_flags');
  } catch (err) {
    console.error('Failed to reset feature flags:', err);
  }
}

// For admin/debug panel
export function getAllFlags(): FeatureFlags {
  return getFeatureFlags();
}

