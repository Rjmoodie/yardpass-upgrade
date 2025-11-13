import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TrackingData {
  post_id: string;
  event_id: string;
  source?: string;
}

// Generate or get session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('liventix_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('liventix_session_id', sessionId);
  }
  return sessionId;
};

export function useVideoAnalytics() {
  const viewTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const viewStartTimes = useRef<Map<string, number>>(new Map());
  const trackedViews = useRef<Set<string>>(new Set());

  const trackView = useCallback(async (
    data: TrackingData & {
      qualified?: boolean;
      completed?: boolean;
      dwell_ms?: number;
      watch_percentage?: number;
    }
  ) => {
    try {
      const sessionId = getSessionId();
      
      await supabase.functions.invoke('track-analytics', {
        body: {
          type: 'view',
          data: {
            ...data,
            session_id: sessionId,
            source: data.source || window.location.pathname.split('/')[1] || 'home'
          }
        }
      });
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  }, []);

  const trackClick = useCallback(async (
    data: TrackingData & {
      target: 'tickets' | 'details' | 'organizer' | 'share' | 'comment';
    }
  ) => {
    try {
      const sessionId = getSessionId();
      
      await supabase.functions.invoke('track-analytics', {
        body: {
          type: 'click',
          data: {
            ...data,
            session_id: sessionId,
            source: data.source || window.location.pathname.split('/')[1] || 'home'
          }
        }
      });
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  }, []);

  const startViewTracking = useCallback((postId: string, eventId: string, source?: string) => {
    const key = `${postId}_${eventId}`;
    
    // Don't track the same post multiple times in this session
    if (trackedViews.current.has(key)) return;
    
    // Check if page is visible
    if (document.visibilityState !== 'visible') return;
    
    viewStartTimes.current.set(key, Date.now());
    
    // Set timer for qualified view (2 seconds)
    const qualifiedTimer = setTimeout(() => {
      const startTime = viewStartTimes.current.get(key);
      if (startTime && document.visibilityState === 'visible') {
        trackView({
          post_id: postId,
          event_id: eventId,
          source,
          qualified: true,
          dwell_ms: Date.now() - startTime
        });
        trackedViews.current.add(key);
      }
    }, 2000);
    
    viewTimers.current.set(key, qualifiedTimer);
  }, [trackView]);

  const stopViewTracking = useCallback((postId: string, eventId: string) => {
    const key = `${postId}_${eventId}`;
    
    const timer = viewTimers.current.get(key);
    if (timer) {
      clearTimeout(timer);
      viewTimers.current.delete(key);
    }
    
    viewStartTimes.current.delete(key);
  }, []);

  const trackVideoProgress = useCallback((
    postId: string,
    eventId: string,
    video: HTMLVideoElement,
    source?: string
  ) => {
    const handleTimeUpdate = () => {
      if (!video.duration) return;
      
      const percentage = (video.currentTime / video.duration) * 100;
      
      // Track completion at 90%
      if (percentage >= 90) {
        trackView({
          post_id: postId,
          event_id: eventId,
          source,
          completed: true,
          watch_percentage: Math.round(percentage),
          dwell_ms: video.currentTime * 1000
        });
        
        // Remove listener after completion
        video.removeEventListener('timeupdate', handleTimeUpdate);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    
    // Cleanup function
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [trackView]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      viewTimers.current.forEach(timer => clearTimeout(timer));
      viewTimers.current.clear();
      viewStartTimes.current.clear();
    };
  }, []);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Stop all timers when page becomes hidden
        viewTimers.current.forEach(timer => clearTimeout(timer));
        viewTimers.current.clear();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return {
    trackView,
    trackClick,
    startViewTracking,
    stopViewTracking,
    trackVideoProgress
  };
}