import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PostHogProvider } from 'posthog-js/react'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { AnalyticsWrapper } from '@/components/AnalyticsWrapper'
import { CSRFProtection } from '@/lib/csrf'
import App from './App.tsx'
import './index.css'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// PostHog configuration for YardPass Analytics
const postHogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  person_profiles: 'identified_only' as const,
  loaded: (posthog: any) => {
    if (import.meta.env.DEV) posthog.debug()
  },
  // Reduce noise and rate limiting
  capture_pageview: false, // We'll manually track pageviews
  capture_pageleave: false,
  disable_session_recording: true,
  rate_limiting: {
    events_burst_limit: 10,
    events_per_second: 3
  }
}

const postHogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY || 'phc_PLACEHOLDER_KEY';

// Initialize CSRF protection
CSRFProtection.enhanceSupabaseClient();
CSRFProtection.generateToken();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <BrowserRouter>
      <PostHogProvider 
        apiKey={postHogKey}
        options={postHogOptions}
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AnalyticsWrapper trackScrollDepth trackTimeOnPage>
              <App />
            </AnalyticsWrapper>
          </AuthProvider>
        </QueryClientProvider>
      </PostHogProvider>
    </BrowserRouter>
  </HelmetProvider>
);
