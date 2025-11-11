import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook for tracking checkout session starts (high purchase intent signal)
 * 
 * This tracks when users initiate checkout, which is a strong indicator
 * of purchase intent (weight: 4.0 in feed ranking).
 * 
 * Features:
 * - Tracks both authenticated and guest users
 * - Deduplicates (one checkout per user/event/hour)
 * - Records checkout details for analytics
 * - Non-blocking (doesn't break checkout flow if tracking fails)
 */
export function useCheckoutTracking() {
  /**
   * Track when user starts checkout
   * 
   * @param eventId - The event being purchased
   * @param totalCents - Total amount in cents
   * @param totalQuantity - Number of tickets
   * @param tierIds - Array of ticket tier IDs
   * @param stripeSessionId - Optional Stripe session ID (if available)
   */
  const trackCheckoutStart = useCallback(async (params: {
    eventId: string;
    totalCents: number;
    totalQuantity: number;
    tierIds: string[];
    stripeSessionId?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get session ID for guests
      const sessionId = !user ? getSessionId() : null;
      
      // Track checkout start in database
      const { error } = await supabase
        .from('checkout_sessions')
        .insert({
          user_id: user?.id || null,
          session_id: sessionId,
          event_id: params.eventId,
          total_cents: params.totalCents,
          total_quantity: params.totalQuantity,
          tier_ids: params.tierIds,
          stripe_session_id: params.stripeSessionId || null,
          started_at: new Date().toISOString(),
          hour_bucket: new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString(), // Current hour
        });
      
      if (error) {
        // Don't throw - tracking is non-blocking
        // Could be a duplicate (which is fine) or other issue
        console.log('[Checkout Tracking] Could not track checkout start:', error.message);
      } else {
        console.log('[Checkout Tracking] Checkout start tracked successfully');
      }
    } catch (err) {
      // Non-blocking: don't break checkout flow if tracking fails
      console.error('[Checkout Tracking] Failed to track checkout start:', err);
    }
  }, []);

  return { trackCheckoutStart };
}

/**
 * Get or create session ID for guest users
 * Used to track anonymous checkout behavior
 */
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('yp_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('yp_session_id', sessionId);
  }
  return sessionId;
}





