import posthog from 'posthog-js';
import { env } from '@/config/env';

// Initialize PostHog
if (typeof window !== 'undefined' && env.posthogKey) {
  posthog.init(env.posthogKey, {
    api_host: env.posthogHost,
    capture_pageview: true,
    loaded: (client) => {
      if (import.meta.env.DEV) client.debug();
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