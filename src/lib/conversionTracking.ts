/**
 * Conversion Tracking for Ad Attribution
 * 
 * Tracks conversions (ticket purchases, signups, etc.) and attributes them
 * to ad impressions/clicks using industry-standard attribution windows:
 * - Last-click attribution: 7 days
 * - View-through attribution: 1 day
 */

import { supabase } from './supabaseClient';

export type ConversionKind = 'purchase' | 'signup' | 'other';

export type ConversionSource = 
  | 'checkout'
  | 'feed'
  | 'event_detail'
  | 'profile'
  | 'explore'
  | 'search';

export interface ConversionMeta {
  userId: string | null;
  sessionId: string;
  kind: ConversionKind;
  valueCents: number;
  ticketId?: string;
  source?: ConversionSource;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
}

export interface ConversionResult {
  success: boolean;
  conversionId: string | null;
  attributionModel: 'last_click_7d' | 'view_through_1d' | 'none' | null;
  clickId: string | null;
  impressionId: string | null;
}

/**
 * Track a conversion event with full attribution
 * 
 * @example
 * ```typescript
 * // After successful ticket purchase
 * const result = await trackConversion({
 *   userId: user?.id,
 *   sessionId: getSessionId(),
 *   kind: 'purchase',
 *   valueCents: ticketPrice * 100,
 *   ticketId: ticket.id,
 *   source: 'checkout'
 * });
 * 
 * if (result.success) {
 *   console.log('Conversion tracked:', result.attributionModel);
 * }
 * ```
 */
export async function trackConversion(
  meta: ConversionMeta
): Promise<ConversionResult> {
  try {
    const deviceType = meta.deviceType || detectDeviceType();
    const userAgent = navigator.userAgent;
    const referrer = document.referrer || null;
    const requestId = crypto.randomUUID();

    const { data, error } = await supabase.rpc('attribute_conversion', {
      p_user_id: meta.userId,
      p_session_id: meta.sessionId,
      p_kind: meta.kind,
      p_value_cents: meta.valueCents,
      p_ticket_id: meta.ticketId || null,
      p_occurred_at: new Date().toISOString(),
      p_request_id: requestId,
      p_conversion_source: meta.source || 'checkout',
      p_device_type: deviceType,
      p_user_agent: userAgent,
      p_referrer: referrer,
    });

    if (error) {
      console.error('[CONVERSION TRACKING] Failed to track conversion:', error);
      return {
        success: false,
        conversionId: null,
        attributionModel: null,
        clickId: null,
        impressionId: null,
      };
    }

    const result = Array.isArray(data) ? data[0] : data;

    console.log('[CONVERSION TRACKING] ✅ Conversion tracked:', {
      conversionId: result?.conversion_id,
      attributionModel: result?.attribution_model,
      valueCents: meta.valueCents,
      kind: meta.kind,
    });

    return {
      success: true,
      conversionId: result?.conversion_id || null,
      attributionModel: result?.attribution_model || null,
      clickId: result?.click_id || null,
      impressionId: result?.impression_id || null,
    };
  } catch (err) {
    console.error('[CONVERSION TRACKING] Exception:', err);
    return {
      success: false,
      conversionId: null,
      attributionModel: null,
      clickId: null,
      impressionId: null,
    };
  }
}

/**
 * Simplified helper for ticket purchase conversions
 * 
 * @example
 * ```typescript
 * await trackTicketPurchase({
 *   userId: user?.id,
 *   sessionId: getSessionId(),
 *   ticketId: ticket.id,
 *   priceCents: 2500, // $25.00
 *   source: 'checkout'
 * });
 * ```
 */
export async function trackTicketPurchase(params: {
  userId: string | null;
  sessionId: string;
  ticketId: string;
  priceCents: number;
  source?: ConversionSource;
}): Promise<ConversionResult> {
  return trackConversion({
    userId: params.userId,
    sessionId: params.sessionId,
    kind: 'purchase',
    valueCents: params.priceCents,
    ticketId: params.ticketId,
    source: params.source || 'checkout',
  });
}

/**
 * Track signup conversions
 * 
 * @example
 * ```typescript
 * await trackSignup({
 *   userId: newUser.id,
 *   sessionId: getSessionId(),
 *   source: 'feed'
 * });
 * ```
 */
export async function trackSignup(params: {
  userId: string;
  sessionId: string;
  source?: ConversionSource;
  valueCents?: number;
}): Promise<ConversionResult> {
  return trackConversion({
    userId: params.userId,
    sessionId: params.sessionId,
    kind: 'signup',
    valueCents: params.valueCents || 0,
    source: params.source || 'checkout',
  });
}

/**
 * Detect device type from user agent
 */
function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent.toLowerCase();
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  
  return 'desktop';
}

/**
 * Get or create a session ID for attribution
 * Uses sessionStorage to persist across page loads in the same session
 */
export function getOrCreateSessionId(): string {
  const key = 'yp_session_id';
  let sessionId = sessionStorage.getItem(key);
  
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  
  return sessionId;
}




