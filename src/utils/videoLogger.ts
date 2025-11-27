/**
 * Video playback observability and logging
 * 
 * Tracks video playback failures, HLS.js errors, and performance metrics
 * for production debugging and monitoring.
 */

import { logger } from './logger';
import { supabase } from '@/integrations/supabase/client';

export type VideoErrorType =
  | 'load_error'
  | 'playback_error'
  | 'hls_fatal_error'
  | 'hls_network_error'
  | 'hls_media_error'
  | 'hls_init_error'
  | 'autoplay_blocked'
  | 'timeout'
  | 'unknown';

export interface VideoErrorEvent {
  type: VideoErrorType;
  playbackId?: string;
  url?: string;
  error: Error | string;
  context?: {
    postId?: string;
    eventId?: string;
    userAgent?: string;
    networkType?: string;
    readyState?: number;
    networkState?: number;
    hlsErrorType?: string;
    hlsErrorDetails?: any;
  };
  timestamp: number;
}

export interface VideoMetricEvent {
  metric: 'time_to_first_frame' | 'time_to_play' | 'buffering_duration' | 'playback_start_failed';
  playbackId?: string;
  url?: string;
  value: number; // milliseconds
  context?: {
    postId?: string;
    eventId?: string;
    userAgent?: string;
    networkType?: string;
  };
  timestamp: number;
}

// In-memory buffer for errors/metrics (sent in batches)
const errorBuffer: VideoErrorEvent[] = [];
const metricBuffer: VideoMetricEvent[] = [];
const BATCH_SIZE = 10;
const FLUSH_INTERVAL = 5000; // 5 seconds

let flushTimer: NodeJS.Timeout | null = null;

/**
 * Log a video error event
 */
export function logVideoError(event: Omit<VideoErrorEvent, 'timestamp'>) {
  const fullEvent: VideoErrorEvent = {
    ...event,
    timestamp: Date.now(),
  };

  // Always log to console for immediate visibility
  logger.error('🎥 Video Error:', {
    type: fullEvent.type,
    playbackId: fullEvent.playbackId,
    error: fullEvent.error,
    context: fullEvent.context,
  });

  // Add to buffer
  errorBuffer.push(fullEvent);

  // Send to analytics (non-blocking)
  try {
    const errorMessage = typeof fullEvent.error === 'string' 
      ? fullEvent.error 
      : fullEvent.error?.message || 'Unknown error';
    
    // Send to Supabase analytics Edge Function
    supabase.functions.invoke('track-analytics', {
      body: {
        type: 'video_error',
        data: {
          error_type: fullEvent.type,
          playback_id: fullEvent.playbackId,
          url: fullEvent.url,
          error_message: errorMessage,
          context: {
            ...fullEvent.context,
            // Include user_id and session_id if available in context
            user_id: fullEvent.context?.user_id || null,
            session_id: fullEvent.context?.session_id || null,
          },
        },
      },
    }).catch((err) => {
      // Silently fail - analytics is non-critical
      logger.debug('Video error analytics failed (non-critical):', err);
    });
  } catch (e) {
    // Analytics failure shouldn't break video playback
    logger.debug('Video error analytics exception (non-critical):', e);
  }

  // Flush if buffer is full
  if (errorBuffer.length >= BATCH_SIZE) {
    flushErrors();
  } else {
    scheduleFlush();
  }
}

/**
 * Log a video performance metric
 */
export function logVideoMetric(event: Omit<VideoMetricEvent, 'timestamp'>) {
  const fullEvent: VideoMetricEvent = {
    ...event,
    timestamp: Date.now(),
  };

  // Log slow metrics in development
  if (import.meta.env.DEV && fullEvent.value > 1000) {
    logger.warn(`🎥 Video Metric (slow): ${fullEvent.metric} = ${fullEvent.value}ms`, {
      playbackId: fullEvent.playbackId,
      context: fullEvent.context,
    });
  }

  // Add to buffer
  metricBuffer.push(fullEvent);

  // Send to analytics (non-blocking)
  try {
    supabase.functions.invoke('track-analytics', {
      body: {
        type: 'video_metric',
        data: {
          metric: fullEvent.metric,
          playback_id: fullEvent.playbackId,
          url: fullEvent.url,
          value: fullEvent.value, // milliseconds
          context: {
            ...fullEvent.context,
            // Include user_id and session_id if available in context
            user_id: fullEvent.context?.user_id || null,
            session_id: fullEvent.context?.session_id || null,
          },
        },
      },
    }).catch((err) => {
      // Silently fail - analytics is non-critical
      logger.debug('Video metric analytics failed (non-critical):', err);
    });
  } catch (e) {
    // Analytics failure shouldn't break video playback
    logger.debug('Video metric analytics exception (non-critical):', e);
  }

  // Flush if buffer is full
  if (metricBuffer.length >= BATCH_SIZE) {
    flushMetrics();
  } else {
    scheduleFlush();
  }
}

/**
 * Schedule a flush of buffered events
 */
function scheduleFlush() {
  if (flushTimer) return;
  
  flushTimer = setTimeout(() => {
    flushErrors();
    flushMetrics();
    flushTimer = null;
  }, FLUSH_INTERVAL);
}

/**
 * Flush error buffer (called on page unload or buffer full)
 */
function flushErrors() {
  if (errorBuffer.length === 0) return;
  
  const errors = [...errorBuffer];
  errorBuffer.length = 0;
  
  // Could send batch to analytics here if needed
  if (import.meta.env.DEV) {
    logger.debug(`Flushed ${errors.length} video errors`);
  }
}

/**
 * Flush metric buffer
 */
function flushMetrics() {
  if (metricBuffer.length === 0) return;
  
  const metrics = [...metricBuffer];
  metricBuffer.length = 0;
  
  if (import.meta.env.DEV) {
    logger.debug(`Flushed ${metrics.length} video metrics`);
  }
}

/**
 * Get network type (if available)
 */
export function getNetworkType(): string | undefined {
  if ('connection' in navigator) {
    const conn = (navigator as any).connection;
    return conn?.effectiveType || conn?.type;
  }
  return undefined;
}

/**
 * Helper to create error context from video element
 */
export function createVideoContext(
  video: HTMLVideoElement | null,
  playbackId?: string,
  postId?: string,
  eventId?: string
): VideoErrorEvent['context'] {
  if (!video) {
    return {
      postId,
      eventId,
      userAgent: navigator.userAgent,
      networkType: getNetworkType(),
    };
  }

  return {
    postId,
    eventId,
    userAgent: navigator.userAgent,
    networkType: getNetworkType(),
    readyState: video.readyState,
    networkState: video.networkState,
  };
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushErrors();
    flushMetrics();
  });
}

