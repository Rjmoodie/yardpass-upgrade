import { capture } from '@/lib/analytics';

// Fix Capacitor Share import issue
let CapacitorShare: any = null;
try {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform) {
    // Dynamic import for Capacitor Share when available
    CapacitorShare = (window as any).CapacitorShare;
  }
} catch {
  // Capacitor not available, will fall back to other methods
}

export interface SharePayload {
  title: string;
  text?: string;
  url: string;
}

export async function sharePayload(payload: SharePayload) {
  if (import.meta.env.DEV) {
    console.log('[Share] sharePayload entry:', payload);
  }
  capture('share_intent', { ...payload } as Record<string, unknown>);
  
  try {
    // Capacitor native share (if available)
    if (CapacitorShare && (window as any).Capacitor?.isNativePlatform) {
      try {
        if (import.meta.env.DEV) {
          console.log('[Share] Using Capacitor native share');
        }
        await CapacitorShare.share({ 
          title: payload.title, 
          text: payload.text, 
          url: payload.url, 
          dialogTitle: 'Share' 
        });
        capture('share_completed', { channel: 'native', ...payload } as Record<string, unknown>);
        return;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.log('[Share] Capacitor Share failed, continuing to web share:', error);
        }
      }
    }

    // Web Share API
    if (navigator.share) {
      if (import.meta.env.DEV) {
        console.log('[Share] Using Web Share API');
      }
      await navigator.share(payload);
      capture('share_completed', { channel: 'web_api', ...payload } as Record<string, unknown>);
      return;
    }
  } catch (error) {
    console.log('Native/Web share failed, falling back to modal:', error);
  }

  // Fallback: open bottom sheet modal
  if (import.meta.env.DEV) {
    console.log('[Share] Opening fallback modal for:', payload);
  }
  window.dispatchEvent(new CustomEvent('open-share-modal', { detail: payload }));
  capture('share_completed', { channel: 'fallback_modal', ...payload } as Record<string, unknown>);
}