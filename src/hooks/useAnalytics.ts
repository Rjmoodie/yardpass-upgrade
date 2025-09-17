// Client analytics tracking with DNT, offline queue, and batching
import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const BATCH_SIZE = 20;
const FLUSH_INTERVAL = 2000; // 2 seconds
const STORAGE_KEY = 'analytics.queue';

// Check for DNT (Do Not Track)
const isDNTEnabled = (): boolean => {
  return (
    navigator.doNotTrack === '1' ||
    (window as any).doNotTrack === '1' ||
    (navigator as any).msDoNotTrack === '1'
  );
};

// Generate session ID
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('analytics.session');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics.session', sessionId);
  }
  return sessionId;
};

// Extract UTM parameters from URL
const getUTMParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content')
  };
};

export function useAnalytics() {
  const { user } = useAuth();
  const queueRef = useRef<any[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout>();
  const isFlushingRef = useRef(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const events = JSON.parse(stored);
        queueRef.current = Array.isArray(events) ? events : [];
        localStorage.removeItem(STORAGE_KEY);
        scheduleFlush();
      }
    } catch (e) {
      console.warn('Failed to load analytics queue from localStorage:', e);
    }
  }, []);

  // Save queue to localStorage when going offline or unloading
  useEffect(() => {
    const saveQueue = () => {
      if (queueRef.current.length > 0) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(queueRef.current));
        } catch (e) {
          console.warn('Failed to save analytics queue to localStorage:', e);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushQueue();
        saveQueue();
      }
    };

    const handleOnline = () => {
      if (queueRef.current.length > 0) {
        scheduleFlush();
      }
    };

    window.addEventListener('beforeunload', saveQueue);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('beforeunload', saveQueue);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

  const flushQueue = async () => {
    if (isFlushingRef.current || queueRef.current.length === 0 || !navigator.onLine) {
      return;
    }

    isFlushingRef.current = true;
    const eventsToFlush = queueRef.current.splice(0);

    try {
      // Process in batches
      for (let i = 0; i < eventsToFlush.length; i += BATCH_SIZE) {
        const batch = eventsToFlush.slice(i, i + BATCH_SIZE);
        
        const { error } = await supabase
          .from('analytics_events')
          .insert(batch);

        if (error) {
          console.error('Failed to insert analytics batch:', error);
          // Re-queue failed events
          queueRef.current.unshift(...batch);
        }
      }
    } catch (error) {
      console.error('Failed to flush analytics queue:', error);
      // Re-queue all events on error
      queueRef.current.unshift(...eventsToFlush);
    } finally {
      isFlushingRef.current = false;
    }
  };

  const scheduleFlush = () => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }
    flushTimeoutRef.current = setTimeout(flushQueue, FLUSH_INTERVAL);
  };

  const track = useCallback((event_type: string, payload: Record<string, any> = {}) => {
    // Respect DNT
    if (isDNTEnabled()) {
      return;
    }

    // Only track to Supabase for authenticated users to avoid RLS issues
    if (!user?.id) {
      return;
    }

    const utmParams = getUTMParams();
    const sessionId = getSessionId();

    const event = {
      event_type,
      user_id: user.id, // Only authenticated users
      event_id: payload.event_id || null,
      ticket_id: payload.ticket_id || null,
      source: payload.source || 'web',
      // Extract these fields as separate columns
      path: window.location.pathname,
      url: window.location.href,
      referrer: document.referrer || null,
      utm_source: utmParams.utm_source,
      utm_medium: utmParams.utm_medium,
      utm_campaign: utmParams.utm_campaign,
      utm_term: utmParams.utm_term,
      utm_content: utmParams.utm_content,
      metadata: {
        ...payload,
        session_id: sessionId,
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language
      },
      created_at: new Date().toISOString()
    };

    queueRef.current.push(event);

    // Flush immediately if queue is full or schedule flush
    if (queueRef.current.length >= BATCH_SIZE) {
      flushQueue();
    } else {
      scheduleFlush();
    }
  }, [user]);

  return { track };
}