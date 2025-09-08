import { useEffect } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useBatchedAnalytics } from '@/hooks/useBatchedAnalytics';
import { useVideoAnalytics } from '@/hooks/useVideoAnalytics';

/**
 * Unified analytics integration hook that coordinates between different analytics systems
 */
export const useAnalyticsIntegration = () => {
  const { track: trackPostHog } = useAnalytics();
  const { track: trackBatched } = useBatchedAnalytics();
  const { trackView, trackClick } = useVideoAnalytics();

  // Unified tracking function that sends to all analytics systems
  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
    // Track to PostHog for web analytics
    trackPostHog(eventName, properties);
    
    // Track to batched analytics for internal metrics
    if (properties?.event_id || properties?.post_id) {
      trackBatched({
        event_type: eventName,
        event_id: properties.event_id,
        user_id: properties.user_id,
        metadata: properties
      });
    }
  };

  // Specialized video tracking
  const trackVideoEvent = (eventName: string, data: { post_id: string; event_id: string; source?: string; target?: string }) => {
    if (eventName === 'video_view') {
      trackView(data);
    } else if (eventName === 'video_click' && data.target) {
      trackClick({ ...data, target: data.target as "comment" | "share" | "details" | "tickets" | "organizer" });
    }
    
    // Also send to unified tracking
    trackEvent(eventName, data);
  };

  return {
    trackEvent,
    trackVideoEvent,
    // Individual system trackers for specific use cases
    trackPostHog,
    trackBatched,
    trackView,
    trackClick
  };
};