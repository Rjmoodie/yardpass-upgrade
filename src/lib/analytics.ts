// Analytics wrapper for feed interactions
export function capture(eventName: string, properties?: Record<string, unknown>) {
  // Integration with PostHog or other analytics service
  if (typeof window !== 'undefined' && (window as any).posthog) {
    (window as any).posthog.capture(eventName, properties);
  } else {
    console.log('Analytics event:', eventName, properties);
  }
}