/**
 * Deferred PostHog Provider
 * 
 * Loads PostHog after initial render to reduce initial bundle size
 * and improve Time to Interactive (TTI).
 * 
 * Impact: ~40 KB reduction from critical path
 */

import { useState, useEffect, ReactNode } from 'react';

const postHogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  person_profiles: 'identified_only' as const,
  loaded: (posthog: any) => {
    // ✅ Only enable debug if explicitly requested via localStorage
    if (import.meta.env.DEV && localStorage.getItem('posthog_debug') === 'true') {
      posthog.debug();
      console.log('[PostHog] Debug mode enabled (disable with: localStorage.removeItem("posthog_debug"))');
    }
  },
  capture_pageview: false,
  capture_pageleave: false,
  disable_session_recording: true,
  rate_limiting: {
    events_burst_limit: 10,
    events_per_second: 3
  }
};

const postHogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY || 'phc_PLACEHOLDER_KEY';

interface DeferredPostHogProps {
  children: ReactNode;
}

export function DeferredPostHog({ children }: DeferredPostHogProps) {
  const [PostHogProvider, setPostHogProvider] = useState<any>(null);

  useEffect(() => {
    // Defer PostHog loading until after initial render
    const loadPostHog = () => {
      import('posthog-js/react').then((module) => {
        setPostHogProvider(() => module.PostHogProvider);
      }).catch((error) => {
        console.error('Failed to load PostHog:', error);
      });
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadPostHog, { timeout: 2000 });
    } else {
      setTimeout(loadPostHog, 1000);
    }
  }, []);

  // Render children without PostHog initially, then with it
  if (!PostHogProvider) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider 
      apiKey={postHogKey}
      options={postHogOptions}
    >
      {children}
    </PostHogProvider>
  );
}

