import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import posthog from 'posthog-js';
import { useAuth } from '@/contexts/AuthContext';

export const INTERACTION_WEIGHTS = {
  event_view: 1,
  video_watch: 2, // ≥40% watch time
  like: 3,
  comment: 4,
  share: 5,
  ticket_open: 6,
  ticket_purchase: 10,
} as const;

type InteractionKind = keyof typeof INTERACTION_WEIGHTS;

const VIEW_CACHE_KEY = 'yp_viewed_events_session';

function getViewedCache(): Record<string, true> {
  try { return JSON.parse(sessionStorage.getItem(VIEW_CACHE_KEY) || '{}'); } catch { return {}; }
}
function setViewedCache(cache: Record<string, true>) {
  sessionStorage.setItem(VIEW_CACHE_KEY, JSON.stringify(cache));
}

export function useInteractionTracking() {
  const { user } = useAuth();

  const trackInteraction = useCallback(async (
    eventId: string, 
    kind: InteractionKind, 
    additionalData?: Record<string, any>
  ) => {
    if (!user?.id || !eventId) return;

    const weight = INTERACTION_WEIGHTS[kind];
    const now = new Date().toISOString();

    // (Optional) de-dupe super-chatty events on client side (e.g., rapid likes)
    // Keep as-is; we’ll focus de-dupe on views with the helper below.

    try {
      // Store in Supabase for recommendations
      const { error } = await supabase
        .from('user_event_interactions')
        .insert({
          user_id: user.id,
          event_id: eventId,
          interaction_type: kind,
          weight,
          created_at: now,
          metadata: additionalData || {}
        });

      if (error) {
        console.error('Error tracking interaction:', error);
      }

      // Send to PostHog for analytics
      posthog.capture(kind, { 
        event_id: eventId,
        weight,
        ...additionalData 
      });

      // Refresh user embedding for high-signal actions
      if (['ticket_open', 'ticket_purchase', 'like', 'share', 'comment'].includes(kind)) {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-user-embed`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            // If you’ve protected the function with JWT verification, pass a service token from server instead.
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ userId: user.id })
        }).catch(err => console.warn('Error refreshing user embedding:', err));
      }

    } catch (error) {
      console.error('Error in trackInteraction:', error);
    }
  }, [user?.id]);

  /**
   * Track a view only once per session per event (prevents noise).
   */
  const trackViewOnce = useCallback(async (eventId: string, extra?: Record<string, any>) => {
    if (!user?.id || !eventId) return;

    const cache = getViewedCache();
    const key = `${user.id}:${eventId}`;
    if (cache[key]) return;

    cache[key] = true;
    setViewedCache(cache);

    await trackInteraction(eventId, 'event_view', extra);
  }, [user?.id, trackInteraction]);

  return { trackInteraction, trackViewOnce };
}
