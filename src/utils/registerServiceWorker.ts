/**
 * Service Worker Registration
 * 
 * Registers the service worker for offline support and improved performance.
 * Implements update detection and prompt for new versions.
 */

import { posthog } from 'posthog-js';

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return null;
  }
  
  // Don't register in development (causes issues with HMR)
  if (import.meta.env.DEV) {
    console.log('[SW] Skipping service worker in development');
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    
    console.log('[SW] Service worker registered:', registration.scope);
    
    // Track installation
    posthog?.capture('service_worker_registered', {
      scope: registration.scope,
      updatefound: !!registration.installing,
    });
    
    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      if (!newWorker) return;
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available
          console.log('[SW] New version available');
          
          posthog?.capture('service_worker_update_available');
          
          // Notify user (you can show a toast/banner here)
          if (window.confirm('A new version of YardPass is available. Reload to update?')) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }
        }
      });
    });
    
    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] New service worker activated');
      posthog?.capture('service_worker_activated');
    });
    
    // Periodic update check (every hour)
    setInterval(() => {
      registration.update().catch(err => {
        console.error('[SW] Update check failed:', err);
      });
    }, 60 * 60 * 1000);
    
    return registration;
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    
    posthog?.capture('service_worker_registration_failed', {
      error: (error as Error).message,
    });
    
    return null;
  }
}

// Utility to clear all caches (for debugging)
export async function clearServiceWorkerCache() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  
  const registration = await navigator.serviceWorker.ready;
  
  if (registration.active) {
    const messageChannel = new MessageChannel();
    
    return new Promise((resolve) => {
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.success);
      };
      
      registration.active?.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  }
}

// Utility to check if app is running as PWA
export function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone ||
    document.referrer.includes('android-app://')
  );
}

// Utility to check if PWA can be installed
export function canInstallPWA(): boolean {
  return !isPWA() && 'beforeinstallprompt' in window;
}

