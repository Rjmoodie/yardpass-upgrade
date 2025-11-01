/**
 * Purchase Intent Tracking Hooks
 * 
 * Tracks high-value user actions that indicate purchase intent:
 * - Ticket detail views (when user opens ticket modal)
 * - Profile visits (when user clicks organizer profile)
 * 
 * These signals feed into the feed ranking algorithm to optimize for ticket purchases.
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Get or create session ID for tracking
 * Uses localStorage to persist across page loads
 */
function getSessionId(): string {
  const storageKey = 'yardpass_session_id';
  let sessionId = localStorage.getItem(storageKey);
  
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
}

/**
 * Hook to track ticket detail views
 * Call this when user opens the ticket modal/sheet
 * 
 * @example
 * const { trackTicketView } = useTicketDetailTracking();
 * 
 * const handleOpenTicketModal = (eventId: string) => {
 *   trackTicketView(eventId, 'GA'); // Track before showing modal
 *   setShowModal(true);
 * };
 */
export function useTicketDetailTracking() {
  const trackTicketView = useCallback(async (
    eventId: string,
    tierViewed?: string
  ) => {
    try {
      const sessionId = getSessionId();
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('ticket_detail_views')
        .insert({
          event_id: eventId,
          user_id: user?.id || null,
          session_id: sessionId,
          tier_viewed: tierViewed || null,
        });
      
      if (error) {
        // 409 Conflict is expected for duplicate views (deduplication working)
        if (error.code !== '23505') {  // unique violation
          console.error('[Purchase Intent] Failed to track ticket view:', error);
        }
      }
    } catch (err) {
      // Non-blocking: don't break UX if tracking fails
      console.error('[Purchase Intent] Unexpected error tracking ticket view:', err);
    }
  }, []);
  
  return { trackTicketView };
}

/**
 * Hook to track profile visits
 * Call this when user navigates to organizer profile page or clicks organizer name
 * 
 * @example
 * const { trackProfileVisit } = useProfileVisitTracking();
 * 
 * const handleClickOrganizer = (organizerId: string) => {
 *   trackProfileVisit(organizerId);
 *   router.push(`/profile/${organizerId}`);
 * };
 */
export function useProfileVisitTracking() {
  const trackProfileVisit = useCallback(async (
    visitedUserId: string
  ) => {
    try {
      const sessionId = getSessionId();
      const { data: { user } } = await supabase.auth.getUser();
      
      // Don't track visits to own profile
      if (user?.id === visitedUserId) {
        return;
      }
      
      const { error } = await supabase
        .from('profile_visits')
        .insert({
          visited_user_id: visitedUserId,
          visitor_id: user?.id || null,
          session_id: sessionId,
        });
      
      if (error) {
        // 409 Conflict is expected for duplicate visits (deduplication working)
        if (error.code !== '23505') {  // unique violation
          console.error('[Purchase Intent] Failed to track profile visit:', error);
        }
      }
    } catch (err) {
      // Non-blocking: don't break UX if tracking fails
      console.error('[Purchase Intent] Unexpected error tracking profile visit:', err);
    }
  }, []);
  
  return { trackProfileVisit };
}

/**
 * Combined hook for all purchase intent tracking
 * Use this if you need multiple tracking methods in one component
 * 
 * @example
 * const { trackTicketView, trackProfileVisit } = usePurchaseIntentTracking();
 */
export function usePurchaseIntentTracking() {
  const { trackTicketView } = useTicketDetailTracking();
  const { trackProfileVisit } = useProfileVisitTracking();
  
  return {
    trackTicketView,
    trackProfileVisit,
  };
}

