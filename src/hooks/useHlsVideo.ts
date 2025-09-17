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
        console.log('useHlsVideo: Starting video setup for:', src);
        const Hls = (await import('hls.js')).default;
        console.log('useHlsVideo: HLS.js loaded, isSupported:', Hls.isSupported());
        
        if (isHls && !canPlayNative && Hls.isSupported()) {
          console.log('useHlsVideo: Using HLS.js for:', src);
          const hls = new Hls({ 
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            startFragPrefetch: true,
            testBandwidth: false,
            progressive: true
          });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(v);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('useHlsVideo: Manifest parsed for:', src);
            !disposed && setReady(true);
          });
          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('useHlsVideo: HLS error for:', src, event, data);
            !disposed && setReady(true);
          });
        } else {
          console.log('useHlsVideo: Using native video for:', src, 'canPlayNative:', canPlayNative);
          v.src = src;
          v.onloadedmetadata = () => {
            console.log('useHlsVideo: Native video metadata loaded for:', src);
            !disposed && setReady(true);
          };
          v.onerror = (e) => {
            console.error('useHlsVideo: Native video error for:', src, e);
          };
        }
      } catch (e) {
        console.error('useHlsVideo: Exception loading HLS.js for:', src, e);
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