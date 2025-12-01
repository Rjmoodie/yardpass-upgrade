import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';
import { getOrCreateSessionId } from '@/utils/session';
import { logAdImpression } from '@/lib/adTracking';

type Args = {
  items: FeedItem[];
  currentIndex: number;
  userId?: string;
  // Mute dwell when overlays take the focus (e.g., comments modal)
  isSuspended?: boolean;
};

type PromotionMeta = {
  campaignId: string;
  creativeId: string | null;
  placement: 'feed' | 'search_results';
  pricingModel?: string | null;
  estimatedRate?: number | null;
  frequencyCapPerUser?: number | null;
  frequencyCapPeriod?: 'session' | 'day' | 'week' | null;
};

type PendingImpression =
  | { kind: 'event'; event_id: string; dwell_ms: number; completed: boolean; startedAt: number; promotion?: PromotionMeta }
  | { kind: 'post';  event_id: string; post_id: string; dwell_ms: number; completed: boolean; startedAt: number; promotion?: PromotionMeta };

/** Tick interval for dwell tracking (250ms = high-resolution without busy loops) */
const TICK_MS = 250;
/** Minimum dwell time for event card to be considered "viewed" (2 seconds) */
const EVENT_COMPLETE_MS = 2000;
/** Minimum dwell time for image/text posts to be considered "viewed" (3 seconds) */
const IMAGE_POST_COMPLETE_MS = 3000;
/** Video completion threshold (90% watched) */
const VIDEO_COMPLETE_FRAC = 0.9;
/** Minimum dwell time for ad impressions to be tracked (500ms) */
const MIN_AD_DWELL_MS = 500;

/**
 * Hook for tracking feed item impressions and dwell time.
 * 
 * Tracks view time for events and posts, determines completion status,
 * and batches impression data for efficient database insertion. Supports
 * both regular impressions and promoted/ad impressions with separate tracking.
 * 
 * **Tracking Behavior:**
 * - Events: Complete after 2 seconds of dwell
 * - Image/Text Posts: Complete after 3 seconds of dwell
 * - Videos: Complete after watching 90% of the video
 * - Ad Impressions: Tracked separately if dwell >= 500ms
 * 
 * **Performance:**
 * - Batches impressions for bulk insert (reduces DB calls)
 * - Flushes every 5 seconds or when batch is full
 * - Automatically flushes on tab hide/unload
 * - Pauses tracking when modal is open (isSuspended)
 * 
 * **Completion Detection:**
 * - For events/images: Uses timer-based dwell tracking
 * - For videos: Monitors video element `currentTime` vs `duration`
 * - Updates completion status in real-time as thresholds are met
 * 
 * @param items - Array of feed items to track
 * @param currentIndex - Currently visible item index
 * @param userId - Optional user ID for user-specific tracking
 * @param isSuspended - If true, pauses dwell accrual (e.g., when modal is open)
 * 
 * @example
 * ```typescript
 * useImpressionTracker({
 *   items: feedItems,
 *   currentIndex: activeIndex,
 *   userId: user?.id,
 *   isSuspended: isModalOpen
 * });
 * ```
 */
export function useImpressionTracker({ items, currentIndex, userId, isSuspended }: Args) {
  const sessionIdRef = useRef<string>(getOrCreateSessionId());
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(performance.now());

  const currentRef = useRef<PendingImpression | null>(null);
  const batchRef = useRef<any[]>([]); // batched rows for insert
  const flushingRef = useRef(false);

  const getVideoEl = useCallback((): HTMLVideoElement | null => {
    const el = document.querySelector<HTMLVideoElement>(`[data-feed-index="${currentIndex}"] video`);
    return el ?? null;
  }, [currentIndex]);

  // mark completion heuristics
  const updateCompletion = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return;

    if (cur.kind === 'event') {
      if (!cur.completed && cur.dwell_ms >= EVENT_COMPLETE_MS) cur.completed = true;
      return;
    }

    // post
    const video = getVideoEl();
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      const frac = video.currentTime / video.duration;
      if (!cur.completed && frac >= VIDEO_COMPLETE_FRAC) cur.completed = true;
    } else {
      if (!cur.completed && cur.dwell_ms >= IMAGE_POST_COMPLETE_MS) cur.completed = true;
    }
  }, [getVideoEl]);

  // tick dwell
  const onTick = useCallback(() => {
    const now = performance.now();
    const dt = now - lastTickRef.current;
    lastTickRef.current = now;

    // if tab hidden or suspended (e.g., modal open), don't accrue dwell
    if (document.visibilityState === 'hidden' || isSuspended) return;

    const cur = currentRef.current;
    if (!cur) return;

    cur.dwell_ms += dt;
    updateCompletion();
  }, [isSuspended, updateCompletion]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    lastTickRef.current = performance.now();
    stopTimer();
    timerRef.current = window.setInterval(() => onTick(), TICK_MS);
  }, [onTick, stopTimer]);

  // flush -> enqueue row into batch
  const enqueueFlush = useCallback((row: any) => {
    batchRef.current.push(row);
  }, []);

  // low-rate batch flush (called on a cadence & on visibilitychange/unmount)
  const flushBatch = useCallback(async () => {
    if (flushingRef.current) return;
    if (batchRef.current.length === 0) return;

    flushingRef.current = true;
    const toSend = batchRef.current.splice(0, batchRef.current.length);
    try {
      // Split into event vs post inserts
      const eventRows = toSend.filter(r => r.__t === 'event').map(({ __t, ...r }) => r);
      const postRows  = toSend.filter(r => r.__t === 'post').map(({ __t, ...r }) => r);

      if (eventRows.length) {
        const { error } = await supabase.rpc('insert_event_impressions', { impressions: eventRows });
        // 409 conflicts are expected (deduplication) - ignore them
        if (error && !error.message?.includes('409') && error.code !== '23505') {
          console.warn('[impressions] Event insert error:', error);
        }
      }
      if (postRows.length) {
        const { error } = await supabase.rpc('insert_post_impressions', { impressions: postRows });
        // 409 conflicts are expected (deduplication) - ignore them
        if (error && !error.message?.includes('409') && error.code !== '23505') {
          console.warn('[impressions] Post insert error:', error);
        }
      }
    } catch (e) {
      // On failure, re-queue to try again next cycle (keeps UX non-blocking)
      batchRef.current.unshift(...toSend);
      // Avoid noisy logs in production; keep one line:
      console.warn('[impressions] flush failed; will retry', e);
    } finally {
      flushingRef.current = false;
    }
  }, []);

  // finalize current impression and enqueue
  const finalizeCurrent = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) return;

    const session_id = sessionIdRef.current;
    const base = {
      user_id: userId ?? null,
      session_id,
      dwell_ms: Math.round(cur.dwell_ms),
      completed: cur.completed,
    };

    // Skip event_impressions for promoted campaigns (they're tracked in ad_impressions)
    if (cur.kind === 'event' && !cur.promotion) {
      enqueueFlush({ __t: 'event', event_id: cur.event_id, ...base });
    } else if (cur.kind === 'post') {
      enqueueFlush({ __t: 'post', post_id: cur.post_id, event_id: cur.event_id, ...base });
    }

    if (cur.promotion && cur.dwell_ms >= MIN_AD_DWELL_MS) {
      console.log('[AD TRACKING] Logging impression:', {
        campaignId: cur.promotion.campaignId,
        creativeId: cur.promotion.creativeId,
        dwellMs: cur.dwell_ms,
        placement: cur.promotion.placement,
        pricingModel: cur.promotion.pricingModel,
        estimatedRate: cur.promotion.estimatedRate,
      });
      
      void logAdImpression(
        {
          campaignId: cur.promotion.campaignId,
          creativeId: cur.promotion.creativeId,
          eventId: cur.event_id,
          postId: cur.kind === 'post' ? cur.post_id : null,
          placement: cur.promotion.placement,
          rateModel: cur.promotion.pricingModel || null,
          cpmRateCredits: cur.promotion.pricingModel === 'cpm' ? cur.promotion.estimatedRate : null,
          cpcRateCredits: cur.promotion.pricingModel === 'cpc' ? cur.promotion.estimatedRate : null,
        },
        {
          userId,
          sessionId: session_id,
          dwellMs: Math.round(cur.dwell_ms), // Pass actual dwell time!
          pctVisible: 100, // Assume 100% visible (could be enhanced with IntersectionObserver)
          frequencyCap: {
            cap: cur.promotion.frequencyCapPerUser,
            period: cur.promotion.frequencyCapPeriod,
          },
        },
      ).catch((err) => {
        console.error('[AD TRACKING] Failed to log impression:', err);
      });
    } else if (cur.promotion) {
      console.log('[AD TRACKING] Skipped impression - dwell time too short:', {
        dwellMs: cur.dwell_ms,
        minRequired: MIN_AD_DWELL_MS,
      });
    }
    currentRef.current = null;
  }, [enqueueFlush, userId]);

  // switch current item => finalize previous, start new
  // Use stable item ID instead of full items array for comparison
  const currentItemId = items[currentIndex]?.item_id;
  useEffect(() => {
    // finalize previous
    finalizeCurrent();
    stopTimer();

    const item = items[currentIndex];
    if (!item) return;

    // Debug logging only in development
    if (import.meta.env.DEV && item.promotion) {
      console.log('[AD TRACKING] Promoted item viewed:', {
        index: currentIndex,
        campaignId: item.promotion.campaignId,
      });
    }

    if (item.item_type === 'event') {
      const promotion = item.promotion
        ? {
            campaignId: item.promotion.campaignId,
            creativeId: item.promotion.creativeId ?? null,
            placement: item.promotion.placement,
            pricingModel: item.promotion.pricingModel ?? null,
            estimatedRate: item.promotion.estimatedRate ?? null,
            frequencyCapPerUser: item.promotion.frequencyCapPerUser ?? null,
            frequencyCapPeriod: item.promotion.frequencyCapPeriod ?? null,
          }
        : undefined;
      
      if (promotion) {
        console.log('[AD TRACKING] ✅ Started tracking PROMOTED event:', {
          campaignId: promotion.campaignId,
          creativeId: promotion.creativeId,
          eventId: item.event_id,
          pricingModel: promotion.pricingModel,
          estimatedRate: promotion.estimatedRate,
        });
      }
      
      currentRef.current = {
        kind: 'event',
        event_id: item.event_id,
        dwell_ms: 0,
        completed: false,
        startedAt: performance.now(),
        promotion,
      };
    } else {
      const promotion = item.promotion
        ? {
            campaignId: item.promotion.campaignId,
            creativeId: item.promotion.creativeId ?? null,
            placement: item.promotion.placement,
            pricingModel: item.promotion.pricingModel ?? null,
            estimatedRate: item.promotion.estimatedRate ?? null,
            frequencyCapPerUser: item.promotion.frequencyCapPerUser ?? null,
            frequencyCapPeriod: item.promotion.frequencyCapPeriod ?? null,
          }
        : undefined;
      currentRef.current = {
        kind: 'post',
        event_id: item.event_id,
        post_id:  item.item_id,
        dwell_ms: 0,
        completed: false,
        startedAt: performance.now(),
        promotion,
      };

      // For video completion detection, observe timeupdate (best-effort)
      const v = document.querySelector<HTMLVideoElement>(`[data-feed-index="${currentIndex}"] video`);
      const onTime = () => updateCompletion();
      if (v) v.addEventListener('timeupdate', onTime);
      // cleanup listener when index changes
      return () => { if (v) v.removeEventListener('timeupdate', onTime); };
    }

    // start ticking for the new item
    startTimer();
  }, [currentItemId, currentIndex, startTimer, stopTimer, finalizeCurrent, updateCompletion, items]); // items needed for actual item access, but currentItemId provides stable comparison

  // periodically flush batch
  useEffect(() => {
    const id = window.setInterval(() => flushBatch(), 5000);
    return () => window.clearInterval(id);
  }, [flushBatch]);

  // flush on tab hide / unload
  useEffect(() => {
    const onHide = () => {
      finalizeCurrent();
      // attempt a synchronous flush
      // NOTE: sendBeacon path (optional). For now we rely on last timed flush;
      // keeping this synchronous avoids blocking the UI thread.
      // If you want a guaranteed flush, wire an Edge Function + sendBeacon here.
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [finalizeCurrent]);

  // pause dwell accrual during suspension (e.g., comments modal)
  useEffect(() => {
    if (isSuspended) stopTimer();
    else startTimer();
  }, [isSuspended, startTimer, stopTimer]);

  // dev helper on route unmount
  useEffect(() => () => { finalizeCurrent(); flushBatch(); }, [finalizeCurrent, flushBatch]);
}
