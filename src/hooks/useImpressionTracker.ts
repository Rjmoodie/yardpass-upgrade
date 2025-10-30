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

const TICK_MS = 250;                 // high-resolution dwell tracking without busy looping
const EVENT_COMPLETE_MS = 2000;      // "viewed" rule of thumb for event cards (2s)
const IMAGE_POST_COMPLETE_MS = 3000; // images/text need slightly longer (3s)
const VIDEO_COMPLETE_FRAC = 0.9;     // 90% watched
const MIN_AD_DWELL_MS = 500;

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
        await supabase.from('event_impressions').insert(eventRows, { count: 'exact' });
      }
      if (postRows.length) {
        await supabase.from('post_impressions').insert(postRows, { count: 'exact' });
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

    if (cur.kind === 'event') {
      enqueueFlush({ __t: 'event', event_id: cur.event_id, ...base });
    } else {
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
  useEffect(() => {
    // finalize previous
    finalizeCurrent();
    stopTimer();

    const item = items[currentIndex];
    if (!item) return;

    console.log('[AD TRACKING] Switched to item:', {
      index: currentIndex,
      type: item.item_type,
      id: item.item_id,
      isPromoted: item.isPromoted,
      hasPromotion: !!item.promotion,
      promotionData: item.promotion ? {
        campaignId: item.promotion.campaignId,
        creativeId: item.promotion.creativeId,
        placement: item.promotion.placement,
      } : null,
    });

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
  }, [items, currentIndex, startTimer, stopTimer, finalizeCurrent, updateCompletion]);

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
