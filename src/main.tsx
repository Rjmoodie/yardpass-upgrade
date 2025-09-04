import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PostHogProvider } from 'posthog-js/react'
import App from './App.tsx'
import './index.css'

// PostHog configuration for YardPass Analytics
const postHogOptions = {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only' as const,
  loaded: (posthog: any) => {
    if (import.meta.env.DEV) posthog.debug()
  }
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <PostHogProvider 
      apiKey="phc_PLACEHOLDER_KEY" // Replace with your actual PostHog project key
      options={postHogOptions}
    >
      <App />
    </PostHogProvider>
  </BrowserRouter>
);
