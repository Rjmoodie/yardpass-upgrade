// src/components/AnalyticsWrapper.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalytics } from '@/hooks/useAnalytics';

interface AnalyticsWrapperProps {
  children: React.ReactNode;
  /** Track 25/50/75/100% scroll depth events (default: false) */
  trackScrollDepth?: boolean;
  /** Track time on page and emit on route change/unmount (default: false) */
  trackTimeOnPage?: boolean;

  /** Track outbound link clicks (default: true) */
  trackOutboundLinks?: boolean;
  /** Track file downloads (default: true) */
  trackDownloads?: boolean;
  /** Persist UTM attribution to sessionStorage and attach to events (default: true) */
  trackUTMAttribution?: boolean;
  /** Track window focus/blur (default: false) */
  trackFocus?: boolean;
  /** Track online/offline connectivity (default: false) */
  trackConnectivity?: boolean;
  /** Track client JS errors (default: true) */
  trackClientErrors?: boolean;
  /** Emit one-time page_load metrics on first mount (default: true) */
  trackPageLoad?: boolean;
}

type UTM = Partial<{
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
}>;

const DNT = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.navigator?.doNotTrack === '1' ||
    (window.navigator as any)?.msDoNotTrack === '1' ||
    (window as any)?.doNotTrack === '1'
  );
};

const getSessionId = () => {
  const key = 'analytics.sid';
  let sid = sessionStorage.getItem(key);
  if (!sid && typeof window !== 'undefined' && 'crypto' in window && 'getRandomValues' in crypto) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    sid = Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(key, sid);
  }
  return sid || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const parseUTM = (search: string): UTM => {
  const q = new URLSearchParams(search);
  const utm: UTM = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(k => {
    const v = q.get(k);
    if (v) (utm as any)[k] = v;
  });
  return utm;
};

const isExternal = (a: HTMLAnchorElement) => {
  const href = a.getAttribute('href') || '';
  if (!href) return false;
  // ignore special schemes
  if (/^(mailto:|tel:|sms:|javascript:)/i.test(href)) return false;
  try {
    const url = new URL(a.href);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
};

const isFileDownload = (a: HTMLAnchorElement) => {
  const exts = ['.pdf', '.csv', '.xlsx', '.zip', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.mov', '.avi'];
  const href = (a.getAttribute('href') || '').toLowerCase();
  try {
    const url = new URL(a.href);
    const path = url.pathname.toLowerCase();
    return exts.some(ext => path.endsWith(ext)) || a.hasAttribute('download');
  } catch {
    return exts.some(ext => href.endsWith(ext)) || a.hasAttribute('download');
  }
};

const hasAnyUTM = (utm: UTM) => Object.keys(utm).length > 0;

export const AnalyticsWrapper: React.FC<AnalyticsWrapperProps> = ({
  children,
  trackScrollDepth = false,
  trackTimeOnPage = false,
  trackOutboundLinks = true,
  trackDownloads = true,
  trackUTMAttribution = true,
  trackFocus = false,
  trackConnectivity = false,
  trackClientErrors = true,
  trackPageLoad = true,
}) => {
  const { track } = useAnalytics();
  const location = useLocation();

  const sidRef = useRef<string>('');
  const prevPathRef = useRef<string>('');
  const startTsRef = useRef<number>(Date.now());
  const engagedMsRef = useRef<number>(0);
  const heartbeatRef = useRef<number | null>(null);
  const firedDepthsRef = useRef<Set<number>>(new Set());
  const pageLoadSentRef = useRef<boolean>(false);
  const tickingRef = useRef<boolean>(false); // rAF throttle for scroll

  // Stable meta for each route render
  const meta = useMemo(() => {
    const { pathname, search, hash } = location;
    const url = `${window.location.origin}${pathname}${search}${hash}`;
    const utm = parseUTM(search);
    return { pathname, url, utm, search, hash };
  }, [location]);

  // Initialize basic context once
  useEffect(() => {
    if (DNT()) return;
    sidRef.current = getSessionId();

    // One-time page load metrics
    if (trackPageLoad && !pageLoadSentRef.current) {
      pageLoadSentRef.current = true;
      try {
        const nav = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined;
        const timingPayload = nav
          ? {
              type: nav.type,
              duration: Math.round(nav.duration),
              domInteractive: Math.round(nav.domInteractive || 0),
              domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
              loadEventEnd: Math.round(nav.loadEventEnd || 0),
              transferSize: (nav as any).transferSize ?? undefined,
              encodedBodySize: (nav as any).encodedBodySize ?? undefined,
            }
          : undefined;

        track('page_load', {
          session_id: sidRef.current,
          ua: navigator.userAgent,
          lang: navigator.language,
          viewport_w: window.innerWidth,
          viewport_h: window.innerHeight,
          dpr: window.devicePixelRatio || 1,
          ...timingPayload,
        });
      } catch {
        // ignore
      }
    }

    // Session start marker (first mount)
    track('session_start', {
      session_id: sidRef.current,
      lang: navigator.language,
    });
    // Session end marker (best-effort)
    const onBeforeUnload = () => {
      if (DNT()) return;
      track('session_end', { session_id: sidRef.current });
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (DNT()) return;

    // UTM first/last touch attribution (sessionStorage)
    const utmKeyFirst = 'analytics.utm_first';
    const utmKeyLast = 'analytics.utm_last';
    const landingKey = 'analytics.landing_path';

    const now = Date.now();

    const utm = meta.utm;
    const hadUTM = hasAnyUTM(utm);

    if (trackUTMAttribution) {
      if (!sessionStorage.getItem(landingKey)) {
        sessionStorage.setItem(landingKey, meta.pathname || '/');
      }
      if (hadUTM && !sessionStorage.getItem(utmKeyFirst)) {
        sessionStorage.setItem(utmKeyFirst, JSON.stringify(utm));
      }
      if (hadUTM) {
        sessionStorage.setItem(utmKeyLast, JSON.stringify(utm));
      }
    }

    // If tracking time-on-page, emit for previous route before resetting
    const emitTimeOnPage = () => {
      if (!trackTimeOnPage) return;
      const spent = engagedMsRef.current;
      if (spent > 0 && prevPathRef.current) {
        track('time_on_page', {
          path: prevPathRef.current,
          ms: spent,
          session_id: sidRef.current,
        });
      }
    };

    emitTimeOnPage();

    // Reset for new route
    startTsRef.current = now;
    engagedMsRef.current = 0;
    firedDepthsRef.current.clear();

    const referrer =
      prevPathRef.current
        ? `${window.location.origin}${prevPathRef.current}`
        : document.referrer || undefined;

    // Route change event (SPA)
    if (prevPathRef.current && prevPathRef.current !== meta.pathname) {
      track('route_change', {
        from: prevPathRef.current,
        to: meta.pathname,
        session_id: sidRef.current,
      });
    }

    prevPathRef.current = meta.pathname;

    // Attach attribution (if stored)
    let utm_first: UTM | undefined;
    let utm_last: UTM | undefined;
    if (trackUTMAttribution) {
      try {
        utm_first = JSON.parse(sessionStorage.getItem(utmKeyFirst) || 'null') || undefined;
        utm_last = JSON.parse(sessionStorage.getItem(utmKeyLast) || 'null') || undefined;
      } catch {
        // ignore
      }
    }

    // Page view
    track('page_view', {
      path: meta.pathname,
      url: meta.url,
      title: document.title,
      referrer,
      session_id: sidRef.current,
      landing_path: sessionStorage.getItem(landingKey) || undefined,
      ...(utm_first ? { utm_first } : {}),
      ...(utm_last ? { utm_last } : {}),
      ...(hadUTM ? meta.utm : {}),
    });

    // Heartbeat for engaged time (counts only while visible)
    if (trackTimeOnPage) {
      if (heartbeatRef.current) window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          engagedMsRef.current += 1000;
        }
      }, 1000);
    }

    // Clean up on unmount
    return () => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (trackTimeOnPage) {
        const spent = engagedMsRef.current;
        if (spent > 0) {
          track('time_on_page', {
            path: meta.pathname,
            ms: spent,
            session_id: sidRef.current,
          });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.pathname]); // re-run only when path changes

  // External link & download tracking (document-level)
  useEffect(() => {
    if (DNT() || (!trackOutboundLinks && !trackDownloads)) return;

    const onClick = (e: MouseEvent) => {
      const path = (e.composedPath?.() || []) as Array<EventTarget>;
      const anchor =
        (path.find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined) ||
        (e.target as HTMLElement)?.closest?.('a');

      if (!anchor || !anchor.href) return;
      if (anchor.getAttribute('href')?.startsWith('#')) return;

      const props = {
        url: anchor.href,
        text: (anchor.textContent || '').trim().slice(0, 160) || undefined,
        target: anchor.target || undefined,
        rel: anchor.rel || undefined,
        session_id: sidRef.current,
        path: prevPathRef.current || window.location.pathname,
      };

      if (trackDownloads && isFileDownload(anchor)) {
        track('file_download', props);
        return;
      }
      if (trackOutboundLinks && isExternal(anchor)) {
        track('external_link_click', props);
      }
    };

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true } as any);
  }, [trackOutboundLinks, trackDownloads, track]);

  // Optional: scroll depth tracking
  useEffect(() => {
    if (!trackScrollDepth || DNT()) return;

    const thresholds = [25, 50, 75, 100];

    const measure = () => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollTop = window.pageYOffset || doc.scrollTop || body.scrollTop || 0;
      const viewport = window.innerHeight || doc.clientHeight;
      const full = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        doc.clientHeight,
        doc.scrollHeight,
        doc.offsetHeight
      );
      const pct = Math.min(100, Math.round(((scrollTop + viewport) / Math.max(full, 1)) * 100));
      thresholds.forEach(t => {
        if (pct >= t && !firedDepthsRef.current.has(t)) {
          firedDepthsRef.current.add(t);
          track('scroll_depth', {
            path: prevPathRef.current || window.location.pathname,
            percent: t,
            session_id: sidRef.current,
          });
        }
      });
      tickingRef.current = false;
    };

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(measure);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // fire once in case content is short
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, [trackScrollDepth, track]);

  // Optional: focus/blur tracking
  useEffect(() => {
    if (!trackFocus || DNT()) return;
    const onFocus = () => track('page_focus', { path: window.location.pathname, session_id: sidRef.current });
    const onBlur = () => track('page_blur', { path: window.location.pathname, session_id: sidRef.current });
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, [trackFocus, track]);

  // Optional: connectivity tracking
  useEffect(() => {
    if (!trackConnectivity || DNT()) return;
    const onOnline = () => track('online', { session_id: sidRef.current });
    const onOffline = () => track('offline', { session_id: sidRef.current });
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [trackConnectivity, track]);

  // Optional: client error tracking
  useEffect(() => {
    if (!trackClientErrors || DNT()) return;

    const onError = (event: ErrorEvent) => {
      try {
        track('client_error', {
          message: event.message,
          source: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack?.slice(0, 8000),
          session_id: sidRef.current,
          path: window.location.pathname,
        });
      } catch {
        // ignore
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      try {
        const reason = (event.reason && (event.reason.message || String(event.reason))) || 'unhandledrejection';
        track('client_unhandled_rejection', {
          reason,
          stack: event.reason?.stack?.slice(0, 8000),
          session_id: sidRef.current,
          path: window.location.pathname,
        });
      } catch {
        // ignore
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection as any);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection as any);
    };
  }, [trackClientErrors, track]);

  return <>{children}</>;
};