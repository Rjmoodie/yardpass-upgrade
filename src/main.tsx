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

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
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

initializeCapacitor().then((state) => {
  console.log('[YardPass] Capacitor initialized:', state.platform);
  
  // ✅ Initialize haptics on first user tap (prevents browser warning)
  initHapticsOnFirstTap();
}).catch((error) => {
  console.error('[YardPass] Capacitor initialization error:', error);
});

// 🎯 Register service worker for offline support and 40-60% faster repeat visits
registerServiceWorker().then((registration) => {
  if (registration) {
    console.log('[YardPass] ✅ Service worker registered - offline support enabled');
  }
}).catch((error) => {
  console.warn('[YardPass] ⚠️ Service worker registration failed:', error);
});

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
