import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import posthog from 'posthog-js';
import { useAuth } from '@/contexts/AuthContext';

// Interaction weights as specified
export const INTERACTION_WEIGHTS = {
  event_view: 1,
  video_watch: 2, // ≥40% watch time
  like: 3,
  comment: 4,
  share: 5,
  ticket_open: 6,
  ticket_purchase: 10,
};

export function useInteractionTracking() {
  const { user } = useAuth();

  const trackInteraction = useCallback(async (
    eventId: string, 
    kind: keyof typeof INTERACTION_WEIGHTS, 
    additionalData?: any
  ) => {
    if (!user?.id || !eventId) return;

    const weight = INTERACTION_WEIGHTS[kind];

    try {
      // Store in Supabase for recommendations (via analytics_events table for now)
      const { error } = await supabase
        .from('analytics_events')
        .insert({
          user_id: user.id,
          event_id: eventId,
          event_type: kind,
          metadata: { weight, interaction_type: kind }
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
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ userId: user.id })
        }).catch(err => console.warn('Error refreshing user embedding:', err));
      }

    } catch (error) {
      console.error('Error in trackInteraction:', error);
    }
  }, [user?.id]);

  return { trackInteraction };
}