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
  const storageKey = 'liventix_session_id';
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
      
      // ✅ Use RPC function with ON CONFLICT DO NOTHING to prevent 409 errors entirely
      // The function handles duplicates at the database level, so no HTTP error is raised
      const { data, error } = await supabase.rpc('track_ticket_detail_view', {
        p_event_id: eventId,
        p_user_id: user?.id || null,
        p_session_id: sessionId,
        p_tier_viewed: tierViewed || null,
      });
      
      // If error occurs, it's a real error (not a duplicate)
      if (error) {
        // Only log actual errors (RPC function handles duplicates silently)
        console.error('[Purchase Intent] Failed to track ticket view:', error);
      }
      // If data is NULL, it means duplicate (conflict) - this is expected and silent
      // If data is UUID, it means successfully inserted - also expected
    } catch (err) {
      // Non-blocking: don't break UX if tracking fails
      // Silently fail - this is just analytics
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
      
      // ✅ Use upsert with ignoreDuplicates to avoid 409 errors entirely
      const { error } = await supabase
        .from('profile_visits')
        .insert({
          visited_user_id: visitedUserId,
          visitor_id: user?.id || null,
          session_id: sessionId,
          hour_bucket: new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString(), // Current hour
          visited_at: new Date().toISOString(),
        });
      
      if (error) {
        // Ignore duplicate key violations (23505) - this is intentional deduplication
        if (error.code === '23505') {
          // Silent: this visit was already tracked in this time window
          return;
        }
        
        // Only log actual errors (not duplicates)
        console.error('[Purchase Intent] Failed to track profile visit:', error);
      }
    } catch (err) {
      // Non-blocking: don't break UX if tracking fails
      // Silently fail - this is just analytics
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

