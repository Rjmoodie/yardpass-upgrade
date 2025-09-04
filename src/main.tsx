import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PostHogProvider } from 'posthog-js/react'
import App from './App.tsx'
import './index.css'

// PostHog configuration for YardPass Analytics
const postHogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  person_profiles: 'identified_only' as const,
  loaded: (posthog: any) => {
    if (import.meta.env.DEV) posthog.debug()
  }
}

const postHogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY || 'phc_PLACEHOLDER_KEY';

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <PostHogProvider 
      apiKey={postHogKey}
      options={postHogOptions}
    >
      <App />
    </PostHogProvider>
  </BrowserRouter>
);
