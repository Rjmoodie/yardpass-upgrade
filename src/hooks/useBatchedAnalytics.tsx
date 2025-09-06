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
      if (queueRef.current.length > 0 && navigator.sendBeacon) {
        // Use sendBeacon for best-effort delivery
        navigator.sendBeacon(
          '/api/analytics',
          JSON.stringify(queueRef.current)
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      flushQueue(); // Final flush
    };
  }, []);

  return { track };
};