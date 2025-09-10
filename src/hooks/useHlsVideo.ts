// src/hooks/useHlsVideo.ts
import { useEffect, useRef, useState } from 'react';

export function useHlsVideo(src?: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;

    setReady(false);
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    v.src = '';
    v.load();

    const isHls = src.endsWith('.m3u8');
    const canPlayNative = v.canPlayType('application/vnd.apple.mpegurl') !== '';

    let disposed = false;

    (async () => {
      try {
        const Hls = (await import('hls.js')).default;
        if (isHls && !canPlayNative && Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(v);
          hls.on(Hls.Events.MANIFEST_PARSED, () => !disposed && setReady(true));
          hls.on(Hls.Events.ERROR, () => !disposed && setReady(true));
        } else {
          v.src = src;
          v.onloadedmetadata = () => !disposed && setReady(true);
        }
      } catch {
        if (v) {
          v.src = src;
          v.onloadedmetadata = () => !disposed && setReady(true);
        }
      }
    })();

    return () => {
      disposed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      try { v?.pause(); } catch {}
    };
  }, [src]);

  return { videoRef, ready };
}