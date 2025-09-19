import posthog from 'posthog-js';

// Initialize PostHog
if (typeof window !== 'undefined') {
  posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: true,
    loaded: (posthog) => {
      if (import.meta.env.DEV) posthog.debug();
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