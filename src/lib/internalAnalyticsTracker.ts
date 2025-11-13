/**
 * Internal Analytics Tracker
 * Sends events to analytics.events table for first-party tracking
 */

import { supabase } from '@/integrations/supabase/client';

// Session ID management
const SESSION_KEY = 'liventix_session_id';
const ANON_KEY = 'liventix_anon_id';

export function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function getAnonId(): string {
  let anonId = localStorage.getItem(ANON_KEY);
  if (!anonId) {
    anonId = `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(ANON_KEY, anonId);
  }
  return anonId;
}

// Device detection
export function detectDevice(): { type: string; os: string; browser: string } {
  const ua = navigator.userAgent.toLowerCase();
  
  const type = /mobile|android|iphone|ipad|ipod/.test(ua) 
    ? (/ipad|tablet/.test(ua) ? 'tablet' : 'mobile')
    : 'desktop';
  
  const os = /mac os/.test(ua) ? 'macos'
    : /windows/.test(ua) ? 'windows'
    : /android/.test(ua) ? 'android'
    : /ios|iphone|ipad/.test(ua) ? 'ios'
    : /linux/.test(ua) ? 'linux'
    : 'unknown';
  
  const browser = /chrome/.test(ua) ? 'chrome'
    : /safari/.test(ua) ? 'safari'
    : /firefox/.test(ua) ? 'firefox'
    : /edge/.test(ua) ? 'edge'
    : 'unknown';
  
  return { type, os, browser };
}

// Parse UTM parameters
export function parseUTM(searchParams?: string): Record<string, string> {
  const params = new URLSearchParams(searchParams || window.location.search);
  const utm: Record<string, string> = {};
  
  const utmParams = ['source', 'medium', 'campaign', 'term', 'content'];
  utmParams.forEach(param => {
    const value = params.get(`utm_${param}`);
    if (value) utm[param] = value;
  });
  
  return utm;
}

// Track event to analytics.events table
export interface TrackEventOptions {
  eventName: string;
  eventId?: string;
  orgId?: string;
  postId?: string;
  props?: Record<string, any>;
  skipIdentityPromotion?: boolean;
}

export async function trackInternalEvent(options: TrackEventOptions): Promise<boolean> {
  try {
    const sessionId = getSessionId();
    const anonId = getAnonId();
    const device = detectDevice();
    const utm = parseUTM();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    // If user just authenticated and we haven't promoted yet, promote identity
    if (user && !options.skipIdentityPromotion) {
      // Check if this session needs promotion
      const needsPromotion = sessionStorage.getItem('liventix_identity_promoted') !== 'true';
      
      if (needsPromotion) {
        await supabase.rpc('analytics.promote_anonymous_identity', {
          p_session_id: sessionId,
          p_anon_id: anonId,
          p_user_id: user.id
        }).catch(err => {
          console.warn('[Analytics] Identity promotion failed:', err);
        });
        
        sessionStorage.setItem('liventix_identity_promoted', 'true');
      }
    }
    
    // Insert event
    const { error } = await supabase
      .from('analytics.events')
      .insert({
        event_name: options.eventName,
        user_id: user?.id || null,
        session_id: sessionId,
        anon_id: anonId,
        event_id: options.eventId || null,
        org_id: options.orgId || null,
        post_id: options.postId || null,
        url: window.location.href,
        referrer: document.referrer || null,
        path: window.location.pathname,
        utm: Object.keys(utm).length > 0 ? utm : null,
        device,
        props: options.props || {}
      });
    
    if (error) {
      console.error('[Analytics] Failed to track event:', error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('[Analytics] Exception tracking event:', err);
    return false;
  }
}

// Convenience wrappers for common events
export async function trackPageView(props?: Record<string, any>) {
  return trackInternalEvent({
    eventName: 'page_view',
    props: {
      title: document.title,
      ...props
    }
  });
}

export async function trackEventView(eventId: string, props?: Record<string, any>) {
  return trackInternalEvent({
    eventName: 'event_view',
    eventId,
    props
  });
}

export async function trackTicketCTA(eventId: string, orgId?: string, props?: Record<string, any>) {
  return trackInternalEvent({
    eventName: 'ticket_cta_click',
    eventId,
    orgId,
    props
  });
}

export async function trackCheckoutStarted(eventId: string, props?: Record<string, any>) {
  return trackInternalEvent({
    eventName: 'checkout_started',
    eventId,
    props
  });
}

export async function trackPurchase(eventId: string, orderId: string, totalCents: number, props?: Record<string, any>) {
  return trackInternalEvent({
    eventName: 'purchase',
    eventId,
    props: {
      order_id: orderId,
      total_cents: totalCents,
      ...props
    }
  });
}

export async function trackPostClick(postId: string, eventId: string, target: string, props?: Record<string, any>) {
  return trackInternalEvent({
    eventName: 'post_click',
    postId,
    eventId,
    props: {
      target,
      ...props
    }
  });
}

export async function trackPostView(postId: string, eventId: string, props?: Record<string, any>) {
  return trackInternalEvent({
    eventName: 'post_view',
    postId,
    eventId,
    props
  });
}

export async function trackEventImpression(eventId: string, props?: Record<string, any>) {
  return trackInternalEvent({
    eventName: 'event_impression',
    eventId,
    props
  });
}

// Batch tracking for performance
let eventQueue: TrackEventOptions[] = [];
let flushTimer: NodeJS.Timeout | null = null;

export function trackInternalEventBatched(options: TrackEventOptions) {
  eventQueue.push(options);
  
  // Flush after 2 seconds or 10 events
  if (eventQueue.length >= 10) {
    flushEventQueue();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushEventQueue, 2000);
  }
}

async function flushEventQueue() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  
  if (eventQueue.length === 0) return;
  
  const batch = [...eventQueue];
  eventQueue = [];
  
  // Track all events in parallel
  await Promise.all(
    batch.map(options => trackInternalEvent({ ...options, skipIdentityPromotion: true }))
  );
}

// Call on page unload to ensure events are sent
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushEventQueue();
  });
}

