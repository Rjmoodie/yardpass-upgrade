import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AnalyticsEvent {
  event_type: string;
  event_id?: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

const BATCH_SIZE = 50;
const FLUSH_INTERVAL = 5000; // 5 seconds

export const useBatchedAnalytics = () => {
  const queueRef = useRef<AnalyticsEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout>();

  const flushQueue = async () => {
    if (queueRef.current.length === 0) return;

    const events = queueRef.current.splice(0);
    
    try {
      // Send in batches of BATCH_SIZE
      for (let i = 0; i < events.length; i += BATCH_SIZE) {
        const batch = events.slice(i, i + BATCH_SIZE);
        
        await supabase
          .from('analytics_events')
          .insert(batch.map(event => ({
            ...event,
            created_at: new Date().toISOString()
          })));
      }
    } catch (error) {
      console.error('Failed to flush analytics queue:', error);
      // Re-queue events on failure
      queueRef.current.unshift(...events);
    }
  };

  const scheduleFlush = () => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }
    
    flushTimeoutRef.current = setTimeout(flushQueue, FLUSH_INTERVAL);
  };

  const track = (event: AnalyticsEvent) => {
    queueRef.current.push(event);
    
    // Flush immediately if queue is full
    if (queueRef.current.length >= BATCH_SIZE) {
      flushQueue();
    } else {
      scheduleFlush();
    }
  };

  // Flush on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (queueRef.current.length > 0) {
        // Attempt immediate flush with Supabase
        flushQueue();
      }
    };

    const handleUnload = () => {
      if (queueRef.current.length > 0) {
        // Final attempt to save data
        try {
          localStorage.setItem('yardpass_pending_analytics', JSON.stringify(queueRef.current));
        } catch (e) {
          console.warn('Could not save analytics to localStorage:', e);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);
    
    // Load any pending analytics on mount
    try {
      const pending = localStorage.getItem('yardpass_pending_analytics');
      if (pending) {
        const events = JSON.parse(pending);
        queueRef.current.push(...events);
        localStorage.removeItem('yardpass_pending_analytics');
        scheduleFlush();
      }
    } catch (e) {
      console.warn('Could not load pending analytics from localStorage:', e);
    }
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      flushQueue(); // Final flush
    };
  }, []);

  return { track };
};