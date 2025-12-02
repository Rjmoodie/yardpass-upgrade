import posthog from 'posthog-js';
import { env } from '@/config/env';

const CONSENT_STORAGE_KEY = 'liventix_consent_preferences';
const CONSENT_VERSION = '1.0';

// Check if user has consented to analytics
function hasAnalyticsConsent(): boolean {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.version === CONSENT_VERSION) {
        return parsed.preferences?.analytics === true;
      }
    }
  } catch {
    // If check fails, default to no consent (GDPR-safe)
  }
  return false;
}

// Initialize PostHog only if user has consented
if (typeof window !== 'undefined' && env.posthogKey) {
  // Check consent before initializing
  if (hasAnalyticsConsent()) {
    posthog.init(env.posthogKey, {
      api_host: env.posthogHost,
      capture_pageview: true,
      // Debug mode disabled to reduce console noise
      // Enable manually with: localStorage.setItem('posthog_debug', 'true') then reload
      loaded: (client) => {
        if (import.meta.env.DEV && localStorage.getItem('posthog_debug') === 'true') {
          client.debug();
        }
      }
    });
  } else {
    // Opt out by default if no consent
    posthog.init(env.posthogKey, {
      api_host: env.posthogHost,
      opt_out_capturing_by_default: true,
      loaded: (client) => {
        client.opt_out_capturing();
      }
    });
  }

  // Listen for consent updates
  window.addEventListener('consent-updated', (event: any) => {
    const preferences = event.detail;
    if (preferences.analytics) {
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
  });
}

export function identifyUser(user: { 
  id: string; 
  city?: string; 
  lat?: number; 
  lng?: number; 
  radius_km?: number; 
  tz?: string; 
  favorite_categories?: string[] 
}) {
  posthog.identify(user.id, {
    city: user.city,
    lat: user.lat, 
    lng: user.lng,
    radius_km: user.radius_km,
    tz: user.tz,
    favorite_categories: user.favorite_categories,
  });
}

export { posthog };