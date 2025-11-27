import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { FollowRealtimeProvider } from '@/contexts/FollowRealtimeContext'
import { AnalyticsWrapper } from '@/components/AnalyticsWrapper'
import { DeferredPostHog } from '@/components/DeferredPostHog'
import { CSRFProtection } from '@/lib/csrf'
import { initializeCapacitor } from '@/lib/capacitor-init'
import { registerServiceWorker } from '@/utils/registerServiceWorker'
import App from './App.tsx'
import './styles-new-design.css'  // Base theme tokens + enhanced utilities
import './index.css'              // Performance optimizations + overrides

// Create a client with optimized caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Performance optimizations
      refetchOnWindowFocus: false, // Don't refetch on tab switch (already set)
      retry: 1, // Retry once on failure
      
      // Caching strategy
      staleTime: 1000 * 60 * 2, // Data is fresh for 2 minutes (prevents unnecessary refetches)
      gcTime: 1000 * 60 * 30, // Keep unused data in cache for 30 minutes (was cacheTime)
      
      // Network optimization
      refetchOnMount: 'always', // Refetch on mount to ensure fresh data (can be overridden per query)
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
});

// 🎯 PostHog config moved to DeferredPostHog component (saves ~40 KB from initial bundle)

// Initialize CSRF protection
CSRFProtection.enhanceSupabaseClient();
CSRFProtection.generateToken();

// Initialize Capacitor plugins (async, non-blocking)
import { initHapticsOnFirstTap } from '@/lib/capacitor-init';
import { initIOSCapacitor } from '@/lib/ios-capacitor';
import { Capacitor } from '@capacitor/core';

// Initialize iOS Capacitor settings BEFORE app renders to ensure safe areas are available immediately
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
  initIOSCapacitor().catch((error) => {
    console.warn('[Liventix] ⚠️ iOS Capacitor initialization failed:', error);
  });
}

initializeCapacitor().then((state) => {
  console.log('[Liventix] Capacitor initialized:', state.platform);
  
  // ✅ Initialize haptics on first user tap (prevents browser warning)
  initHapticsOnFirstTap();
}).catch((error) => {
  console.error('[Liventix] Capacitor initialization error:', error);
});

// 🎯 Register service worker for offline support and 40-60% faster repeat visits
registerServiceWorker().then((registration) => {
  if (registration) {
    console.log('[Liventix] ✅ Service worker registered - offline support enabled');
  }
}).catch((error) => {
  console.warn('[Liventix] ⚠️ Service worker registration failed:', error);
});

// Disable browser scroll restoration - we handle it manually
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <BrowserRouter>
      <DeferredPostHog>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <FollowRealtimeProvider>
              <AnalyticsWrapper trackScrollDepth trackTimeOnPage>
                <App />
              </AnalyticsWrapper>
            </FollowRealtimeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </DeferredPostHog>
    </BrowserRouter>
  </HelmetProvider>
);
