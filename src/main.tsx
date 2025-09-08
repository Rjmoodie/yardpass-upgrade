import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PostHogProvider } from 'posthog-js/react'
import { AnalyticsWrapper } from '@/components/AnalyticsWrapper'
import App from './App.tsx'
import './index.css'

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

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <PostHogProvider 
      apiKey={postHogKey}
      options={postHogOptions}
    >
      <AnalyticsWrapper trackScrollDepth trackTimeOnPage>
        <App />
      </AnalyticsWrapper>
    </PostHogProvider>
  </BrowserRouter>
);
