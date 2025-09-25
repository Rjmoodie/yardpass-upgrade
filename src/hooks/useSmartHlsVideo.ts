import { useEffect, useRef } from 'react';
import { getHlsModule, createHlsInstance } from '@/utils/hlsLoader';

export function useSmartHlsVideo(manifestUrl: string, visible: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const el = videoRef.current;
      if (!el || !manifestUrl) return;

      // iOS Safari native HLS
      const canNative = el.canPlayType('application/vnd.apple.mpegurl');
      if (canNative) {
        if (visible) {
          if (el.src !== manifestUrl) {
            el.src = manifestUrl;
            // Preload first few seconds immediately
            el.preload = 'auto';
          }
          try { await el.play().catch(() => {}); } catch {}
        } else {
          try { el.pause(); } catch {}
          // Switch back to metadata preload to save bandwidth
          el.preload = 'metadata';
        }
        return;
      }

      // hls.js path
      const HlsMod = await getHlsModule();
      if (cancelled) return;

      // create once with optimized settings
      if (!hlsRef.current) {
        hlsRef.current = createHlsInstance(HlsMod);
        hlsRef.current.attachMedia(el);
      }

      // swap source only when visible to avoid unnecessary network
      if (visible) {
        hlsRef.current.loadSource(manifestUrl);
        // Trigger immediate buffer start for faster playback
        hlsRef.current.startLoad(0);
        // play may fail silently due to autoplay policy; that's ok
        try { await el.play().catch(() => {}); } catch {}
      } else {
        try { el.pause(); } catch {}
        // Stop loading to save bandwidth when not visible
        hlsRef.current.stopLoad();
      }
    })();

    return () => { cancelled = true; };
  }, [manifestUrl, visible]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      try { videoRef.current?.pause(); } catch {}
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
    };
  }, []);

  return { videoRef };
}