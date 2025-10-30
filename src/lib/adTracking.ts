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
  impressionId?: string | null;
}

export interface ImpressionPayload {
  campaignId: string;
  creativeId: string;
  placement: AdPlacement;
  requestId: string;
  pctVisible: number;
  dwellMs: number;
  viewable: boolean;
  rateCredits?: number;
  pricingModel?: string;
  freqCap?: number;
}

export type FrequencyPeriod = 'session' | 'day' | 'week' | null | undefined;

const FREQUENCY_STORAGE_KEY = 'yp_ad_frequency_v1';
const IMPRESSION_CACHE_KEY = 'yp_ad_impressions';
const IMPRESSION_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour keeps memory in check
const IMPRESSION_ATTRIBUTION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes for click attribution

// In-memory cache for recent impressions (for click attribution)
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

// Cache impressionId by campaignId for click attribution
function cacheImpressionForClick(campaignId: string, impressionId: string): void {
  try {
    const key = `lastImpr:${campaignId}`;
    const data = {
      impressionId,
      ts: Date.now(),
    };
    sessionStorage.setItem(key, JSON.stringify(data));
    console.log('[AD TRACKING] Cached impression for click attribution:', { campaignId, impressionId });
  } catch (err) {
    console.warn('[AD TRACKING] Failed to cache impression:', err);
  }
}

// Retrieve cached impressionId for click (within 30min window)
function getCachedImpressionForClick(campaignId: string): string | null {
  try {
    const key = `lastImpr:${campaignId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    
    const data = JSON.parse(raw);
    const age = Date.now() - data.ts;
    
    if (age > IMPRESSION_ATTRIBUTION_WINDOW_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    return data.impressionId;
  } catch (err) {
    console.warn('[AD TRACKING] Failed to retrieve cached impression:', err);
    return null;
  }
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
    dwellMs?: number;  // Add dwell time parameter
    pctVisible?: number;  // Add visibility percentage parameter
  } = {},
): Promise<string | null> {
  const sessionId = options.sessionId ?? getOrCreateSessionId();
  const userAgent = options.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : null);
  const requestId = typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now().toString();

  pruneImpressionCache();

  // Determine pricing model and rate (round to integer for RPC)
  const pricingModel = meta.rateModel || 'cpm';
  const rawRate = meta.cpmRateCredits || meta.cpcRateCredits || null;
  const rateCredits = rawRate !== null ? Math.round(rawRate) : null;

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
    requestId,
    pricingModel,
    rateCredits,
    pctVisible: options.pctVisible ?? 100, // Use actual visibility or assume 100%
    dwellMs: options.dwellMs ?? 0, // Use actual dwell time from tracker
    viewable: (options.dwellMs ?? 0) >= 1000 && (options.pctVisible ?? 100) >= 50, // IAB viewability standard
    freqCap: options.frequencyCap?.cap ?? null,
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
    
    // Cache by campaignId for easier click attribution lookup
    cacheImpressionForClick(meta.campaignId, impressionId);
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
  const impressionId = cached?.id ?? meta.impressionId ?? null;

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

  // Store click info for conversion attribution
  if (payload?.clickId && typeof window !== 'undefined') {
    try {
      window.sessionStorage?.setItem('yp_last_ad_click', JSON.stringify({
        clickId: payload.clickId,
        campaignId: meta.campaignId,
        creativeId: meta.creativeId,
        timestamp: Date.now(),
      }));
    } catch (err) {
      console.warn('[adTracking] failed to store click for attribution', err);
    }
  }

  return payload?.clickId ?? impressionId;
}

/**
 * Log ad click using sendBeacon (non-blocking, survives page unload)
 * Use this for CTA clicks that navigate away from the page
 */
export function logAdClickBeacon(meta: AdMeta): void {
  if (typeof window === 'undefined') return;

  const sessionId = getOrCreateSessionId();
  const requestId = crypto.randomUUID();
  
  // Try to get impressionId from cache (within 30min window)
  let impressionId = meta.impressionId ?? null;
  if (!impressionId) {
    impressionId = getCachedImpressionForClick(meta.campaignId);
  }

  // Determine pricing model and bid for CPC (round to integer for RPC)
  const pricingModel = meta.rateModel || 'cpc';
  const rawBid = meta.cpcRateCredits || null;
  const bidCredits = rawBid !== null ? Math.round(rawBid) : null;

  const body = JSON.stringify({
    type: 'click',
    meta: {
      campaignId: meta.campaignId,
      creativeId: meta.creativeId ?? null,
      eventId: meta.eventId ?? null,
      postId: meta.postId ?? null,
      placement: meta.placement,
      impressionId,
      pricingModel,
      bidCredits,
    },
    sessionId,
    requestId, // Always send requestId for idempotency
    now: new Date().toISOString(),
  });

  console.log('[AD TRACKING] Logging click via beacon:', {
    campaignId: meta.campaignId,
    impressionId,
    requestId,
  });

  // Use Edge Function directly (sendBeacon causes CORS issues with credentials)
  const edgeFunctionUrl = `${supabase.supabaseUrl}/functions/v1/ad-events`;

  // Use fetch with keepalive for non-blocking request
  fetch(edgeFunctionUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'apikey': supabase.supabaseKey,
      'Authorization': `Bearer ${supabase.supabaseKey}`,
    },
    body,
    keepalive: true,
  })
    .then(() => console.log('[AD TRACKING] ✅ Click logged successfully'))
    .catch((err) => console.error('[AD TRACKING] ❌ Click failed:', err));
}
