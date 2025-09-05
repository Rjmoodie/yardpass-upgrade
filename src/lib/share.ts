import { Share } from '@capacitor/share';
import { capture } from '@/lib/analytics';

export interface SharePayload {
  title: string;
  text?: string;
  url: string;
}

export async function sharePayload(p: SharePayload) {
  capture('share_intent', { ...p } as Record<string, unknown>);
  
  try {
    // Capacitor (iOS/Android app)
    // @ts-ignore
    if ((window as any).Capacitor?.isNativePlatform) {
      await Share.share({ title: p.title, text: p.text, url: p.url, dialogTitle: 'Share' });
      capture('share_completed', { channel: 'native', ...p } as Record<string, unknown>);
      return;
    }
    // Modern browsers (mobile/desktop where supported)
    if (navigator.share) { 
      await navigator.share(p); 
      capture('share_completed', { channel: 'web_api', ...p } as Record<string, unknown>);
      return; 
    }
  } catch { /* fall through */ }
  // Fallback bottom sheet
  window.dispatchEvent(new CustomEvent('open-share-modal', { detail: p }));
  capture('share_completed', { channel: 'fallback_modal', ...p } as Record<string, unknown>);
}