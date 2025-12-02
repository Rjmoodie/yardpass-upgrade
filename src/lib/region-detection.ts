/**
 * Region Detection Utilities
 * Detects user region for compliance (GDPR, CCPA, etc.)
 */

import { supabase } from '@/integrations/supabase/client';

export type Region = 'US' | 'EU' | 'UK' | 'CA' | 'OTHER';

/**
 * Detect region from user's browser/navigator
 * Falls back to IP geolocation if available
 */
export async function detectRegion(): Promise<Region | null> {
  try {
    // Try to detect from browser locale/timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const locale = navigator.language || navigator.languages?.[0] || 'en-US';
    
    // EU countries (simplified list - expand as needed)
    const euCountries = [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];
    
    // Check if locale suggests EU
    const countryCode = locale.split('-')[1]?.toUpperCase();
    if (countryCode && euCountries.includes(countryCode)) {
      return 'EU';
    }
    
    // UK check
    if (countryCode === 'GB' || timezone.includes('London')) {
      return 'UK';
    }
    
    // US/CA check
    if (countryCode === 'US') return 'US';
    if (countryCode === 'CA') return 'CA';
    
    // Timezone-based heuristics (less reliable)
    if (timezone.includes('America/New_York') || timezone.includes('America/Los_Angeles')) {
      return 'US';
    }
    if (timezone.includes('Europe/')) {
      return 'EU';
    }
    
    // Default to null if can't determine
    return null;
  } catch (error) {
    console.warn('[region-detection] Failed to detect region:', error);
    return null;
  }
}

/**
 * Store user's region preference
 */
export async function storeUserRegion(userId: string, region: Region): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ region })
      .eq('user_id', userId);
    
    if (error) {
      console.error('[region-detection] Failed to store region:', error);
    }
  } catch (error) {
    console.error('[region-detection] Error storing region:', error);
  }
}

/**
 * Check if region requires GDPR compliance
 */
export function requiresGDPR(region: Region | null): boolean {
  return region === 'EU' || region === 'UK';
}

/**
 * Check if region requires CCPA compliance
 */
export function requiresCCPA(region: Region | null): boolean {
  return region === 'US'; // CCPA is California-specific, but we'll apply broadly for US
}

