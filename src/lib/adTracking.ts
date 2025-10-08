import { supabase } from '@/integrations/supabase/client';
import { getOrCreateSessionId } from '@/utils/session';

export type AdPlacement = 'feed' | 'search_results' | 'story' | 'event_banner';

type RateModel = 'cpm' | 'cpc' | string;

export interface AdMeta {
  campaignId: string;
  creativeId?: string | null;
  eventId?: string | null;
  postId?: string | null;
  placement: AdPlacement;
  rateModel?: RateModel | null;
  cpmRateCredits?: number | null;
  cpcRateCredits?: number | null;
}

export type FrequencyPeriod = 'session' | 'day' | 'week' | null | undefined;

const FREQUENCY_STORAGE_KEY = 'yp_ad_frequency_v1';
const IMPRESSION_CACHE_KEY = 'yp_ad_impressions';
const IMPRESSION_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour keeps memory in check

const impressionCache = new Map<string, { id: string; ts: number }>();

function cacheKey(meta: AdMeta): string {
  const parts = [
    meta.campaignId,
    meta.creativeId ?? 'n/a',
    meta.eventId ?? 'n/a',
    meta.postId ?? 'n/a',
    meta.placement,
  ];
  return parts.join('|');
}

function pruneImpressionCache() {
  const cutoff = Date.now() - IMPRESSION_CACHE_TTL_MS;
  for (const [key, entry] of impressionCache.entries()) {
    if (entry.ts < cutoff) {
      impressionCache.delete(key);
    }
  }
}

function getWindowMs(period: FrequencyPeriod): number {
  switch (period) {
    case 'session':
      return 1000 * 60 * 60;
    case 'day':
      return 1000 * 60 * 60 * 24;
    case 'week':
      return 1000 * 60 * 60 * 24 * 7;
    default:
      return 0;
  }
}

function readFrequencyMap(): Record<string, number[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FREQUENCY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, number[]>;
    }
  } catch (err) {
    console.warn('[adFrequency] failed to parse local storage', err);
  }
  return {};
}

function writeFrequencyMap(map: Record<string, number[]>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FREQUENCY_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('[adFrequency] failed to persist map', err);
  }
}

function pruneTimestamps(timestamps: number[], period: FrequencyPeriod): number[] {
  if (!timestamps || !timestamps.length) return [];
  const windowMs = getWindowMs(period);
  if (!windowMs) return timestamps;
  const now = Date.now();
  return timestamps.filter((ts) => now - ts <= windowMs);
}

export function canServeCampaign(
  campaignId: string,
  cap?: number | null,
  period?: FrequencyPeriod,
): boolean {
  if (!cap || cap <= 0) return true;
  const map = readFrequencyMap();
  const pruned = pruneTimestamps(map[campaignId] ?? [], period);
  return pruned.length < cap;
}

function recordFrequencyImpression(
  campaignId: string,
  period?: FrequencyPeriod,
): void {
  if (typeof window === 'undefined') return;
  const map = readFrequencyMap();
  const pruned = pruneTimestamps(map[campaignId] ?? [], period);
  pruned.push(Date.now());
  map[campaignId] = pruned;
  writeFrequencyMap(map);
}

async function invokeAdFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('ad-events', { body });
  if (error) {
    throw new Error(error.message ?? 'ad-events invocation failed');
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data ?? {};
}

export async function logAdImpression(
  meta: AdMeta,
  options: {
    userId?: string | null;
    sessionId?: string | null;
    userAgent?: string | null;
    frequencyCap?: { cap?: number | null; period?: FrequencyPeriod };
  } = {},
): Promise<string | null> {
  const sessionId = options.sessionId ?? getOrCreateSessionId();
  const userAgent = options.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : null);

  pruneImpressionCache();

  const payload = await invokeAdFunction({
    type: 'impression',
    meta: {
      campaignId: meta.campaignId,
      creativeId: meta.creativeId ?? null,
      eventId: meta.eventId ?? null,
      postId: meta.postId ?? null,
      placement: meta.placement,
    },
    sessionId,
    userAgent,
    now: new Date().toISOString(),
  });

  const impressionId = typeof payload.impressionId === 'string' ? payload.impressionId : null;
  if (impressionId) {
    impressionCache.set(cacheKey(meta), { id: impressionId, ts: Date.now() });
    if (typeof window !== 'undefined') {
      try {
        const serialized = JSON.stringify({ id: impressionId, ts: Date.now(), meta });
        window.sessionStorage?.setItem(`${IMPRESSION_CACHE_KEY}:${cacheKey(meta)}`, serialized);
      } catch (err) {
        console.warn('[adTracking] failed to memoize impression', err);
      }
    }
  }

  if (options.frequencyCap) {
    recordFrequencyImpression(meta.campaignId, options.frequencyCap.period);
  }

  return impressionId;
}

export async function logAdClick(
  meta: AdMeta,
  options: {
    userId?: string | null;
    sessionId?: string | null;
  } = {},
): Promise<string | null> {
  const sessionId = options.sessionId ?? getOrCreateSessionId();
  pruneImpressionCache();
  const key = cacheKey(meta);
  const cached = impressionCache.get(key);
  const impressionId = cached?.id ?? null;

  const payload = await invokeAdFunction({
    type: 'click',
    meta: {
      campaignId: meta.campaignId,
      creativeId: meta.creativeId ?? null,
      eventId: meta.eventId ?? null,
      postId: meta.postId ?? null,
      placement: meta.placement,
      impressionId,
    },
    sessionId,
    now: new Date().toISOString(),
  });

  if (payload?.success && impressionId) {
    impressionCache.delete(key);
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage?.removeItem(`${IMPRESSION_CACHE_KEY}:${key}`);
      } catch (err) {
        console.warn('[adTracking] failed to clear cached impression', err);
      }
    }
  }

  return impressionId;
}
