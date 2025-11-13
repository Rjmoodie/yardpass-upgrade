import { usePostHog } from 'posthog-js/react';
import { useAuth } from '@/contexts/AuthContext';

export const useAnalytics = () => {
  const posthog = usePostHog();
  const { user } = useAuth();

  const identify = (userId: string, properties?: Record<string, any>) => {
    posthog?.identify(userId, properties);
  };

  const track = (eventName: string, properties?: Record<string, any>) => {
    posthog?.capture(eventName, {
      ...properties,
      user_id: user?.id,
      timestamp: new Date().toISOString(),
    });
  };

  // Event tracking functions per Liventix specs
  const trackEventView = (eventId: string, eventTitle: string) => {
    track('event_view', {
      event_id: eventId,
      event_title: eventTitle,
    });
  };

  const trackTicketCTA = (eventId: string, eventTitle: string, tierId?: string, tierName?: string) => {
    track('ticket_cta_click', {
      event_id: eventId,
      event_title: eventTitle,
      tier_id: tierId,
      tier_name: tierName,
    });
  };

  const trackCheckoutStarted = (eventId: string, tierIds: string[], totalCents: number) => {
    track('checkout_started', {
      event_id: eventId,
      tier_ids: tierIds,
      total_cents: totalCents,
    });
  };

  const trackCheckoutCompleted = (orderId: string, eventId: string, totalCents: number, paymentMethod: string) => {
    track('checkout_completed', {
      order_id: orderId,
      event_id: eventId,
      total_cents: totalCents,
      payment_method: paymentMethod,
    });
  };

  const trackPostCreated = (postId: string, eventId: string, contentType: 'text' | 'image' | 'video') => {
    track('post_created', {
      post_id: postId,
      event_id: eventId,
      content_type: contentType,
    });
  };

  const trackPostEngagement = (postId: string, eventId: string, engagementType: 'like' | 'comment' | 'share') => {
    track('post_engagement', {
      post_id: postId,
      event_id: eventId,
      engagement_type: engagementType,
    });
  };

  const trackShareGenerated = (eventId: string, shareType: 'link' | 'qr' | 'social', platform?: string) => {
    track('share_generated', {
      event_id: eventId,
      share_type: shareType,
      platform,
    });
  };

  const trackTicketScanned = (ticketId: string, eventId: string, scanResult: 'valid' | 'duplicate' | 'expired' | 'invalid') => {
    track('ticket_scanned', {
      ticket_id: ticketId,
      event_id: eventId,
      scan_result: scanResult,
    });
  };

  // Video analytics tracking
  const trackVideoPlay = (videoId: string, eventId?: string) => {
    track('video_play', {
      video_id: videoId,
      event_id: eventId,
    });
  };

  const trackVideoProgress = (videoId: string, progressPercent: number, watchTimeSeconds: number) => {
    track('video_progress', {
      video_id: videoId,
      progress_percent: progressPercent,
      watch_time_seconds: watchTimeSeconds,
    });
  };

  return {
    identify,
    track,
    trackEventView,
    trackTicketCTA,
    trackCheckoutStarted,
    trackCheckoutCompleted,
    trackPostCreated,
    trackPostEngagement,
    trackShareGenerated,
    trackTicketScanned,
    trackVideoPlay,
    trackVideoProgress,
  };
};