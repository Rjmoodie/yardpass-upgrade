import { capture } from '@/lib/analytics';

export interface SharePayload {
  title: string;
  text?: string;
  url: string;
}

export async function sharePayload(payload: SharePayload) {
  capture('share_intent', { ...payload } as Record<string, unknown>);
  
  try {
    // Capacitor native share (if available)
    if ((window as any).Capacitor?.isNativePlatform && (window as any).CapacitorShare) {
      try {
        await (window as any).CapacitorShare.share({ 
          title: payload.title, 
          text: payload.text, 
          url: payload.url, 
          dialogTitle: 'Share' 
        });
        capture('share_completed', { channel: 'native', ...payload } as Record<string, unknown>);
        return;
      } catch (error) {
        console.log('Capacitor Share failed, continuing to web share');
      }
    }

    // Web Share API
    if (navigator.share) {
      await navigator.share(payload);
      capture('share_completed', { channel: 'web_api', ...payload } as Record<string, unknown>);
      return;
    }
  } catch (error) {
    console.log('Native/Web share failed, falling back to modal:', error);
  }

  // Fallback: open bottom sheet modal
  window.dispatchEvent(new CustomEvent('open-share-modal', { detail: payload }));
}