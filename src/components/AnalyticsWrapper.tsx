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
  
  // Check standard doNotTrack properties
  return (
    window.navigator?.doNotTrack === '1' ||
    (window.navigator as any)?.msDoNotTrack === '1' ||
    (window as any)?.doNotTrack === '1'
  );
};

const getSessionId = () => {
  const key = 'analytics.sid';
  let sid = sessionStorage.getItem(key);
  if (!sid && 'crypto' in window && 'getRandomValues' in crypto) {
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
  try {
    const url = new URL(a.href);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
};

const isFileDownload = (a: HTMLAnchorElement) => {
  const exts = ['.pdf', '.csv', '.xlsx', '.zip', '.png', '.jpg', '.jpeg', '.webp', '.mp4', '.mov'];
  const href = (a.getAttribute('href') || '').toLowerCase();
  return exts.some(ext => href.endsWith(ext)) || a.hasAttribute('download');
};

export const AnalyticsWrapper: React.FC<AnalyticsWrapperProps> = ({
  children,
  trackScrollDepth = false,
  trackTimeOnPage = false,
}) => {
  const { track } = useAnalytics();
  const location = useLocation();

  const sidRef = useRef<string>('');
  const prevPathRef = useRef<string>('');
  const startTsRef = useRef<number>(Date.now());
  const engagedMsRef = useRef<number>(0);
  const heartbeatRef = useRef<number | null>(null);
  const firedDepthsRef = useRef<Set<number>>(new Set());

  // Stable meta for each route render
  const meta = useMemo(() => {
    const { pathname, search, hash } = location;
    const url = `${window.location.origin}${pathname}${search}${hash}`;
    const utm = parseUTM(search);
    return { pathname, url, utm };
  }, [location]);

  // Initialize basic context once
  useEffect(() => {
    if (DNT()) return;
    sidRef.current = getSessionId();
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (DNT()) return;

    const now = Date.now();

    // If tracking time-on-page, emit event for previous route before resetting timers
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

    prevPathRef.current = meta.pathname;

    track('page_view', {
      path: meta.pathname,
      url: meta.url,
      title: document.title,
      referrer,
      session_id: sidRef.current,
      ...meta.utm,
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

    return () => {
      // flush heartbeat on unmount
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      // also emit time on page on unmount (e.g., leaving app)
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
    if (DNT()) return;

    const onClick = (e: MouseEvent) => {
      const path = (e.composedPath?.() || []) as Array<EventTarget>;
      const anchor = path.find(
        (el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement
      ) || (e.target as HTMLElement)?.closest?.('a');

      if (!anchor || !anchor.href) return;

      // Ignore in-page anchors
      if (anchor.getAttribute('href')?.startsWith('#')) return;

      // Respect modified/middle clicks (we still track)
      const props = {
        url: anchor.href,
        text: (anchor.textContent || '').trim().slice(0, 160),
        target: anchor.target || undefined,
        rel: anchor.rel || undefined,
        session_id: sidRef.current,
      };

      if (isFileDownload(anchor)) {
        track('file_download', props);
        return;
      }

      if (isExternal(anchor)) {
        track('external_link_click', props);
      }
    };

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true } as any);
  }, [track]);

  // Optional: scroll depth tracking
  useEffect(() => {
    if (!trackScrollDepth || DNT()) return;

    const thresholds = [25, 50, 75, 100];

    const onScroll = () => {
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
      const pct = Math.min(100, Math.round(((scrollTop + viewport) / full) * 100));

      thresholds.forEach(t => {
        if (pct >= t && !firedDepthsRef.current.has(t)) {
          firedDepthsRef.current.add(t);
          track('scroll_depth', {
            path: meta.pathname,
            percent: t,
            session_id: sidRef.current,
          });
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // fire once in case content is short
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, [trackScrollDepth, meta.pathname, track]);

  return <>{children}</>;
};