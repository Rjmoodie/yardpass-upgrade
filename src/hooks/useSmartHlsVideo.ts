import { useEffect, useRef } from 'react';
import { getHlsModule, createHlsInstance } from '@/utils/hlsLoader';

export function useSmartHlsVideo(manifestUrl: string, visible: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const el = videoRef.current;
      if (!el || !manifestUrl) {
        console.log('🚫 Video element or manifest URL missing:', { hasElement: !!el, manifestUrl });
        return;
      }

      console.log('🎥 Setting up video for URL:', manifestUrl);

      // iOS Safari native HLS
      const canNative = el.canPlayType('application/vnd.apple.mpegurl');
      if (canNative) {
        console.log('📱 Using native HLS support');
        if (visible) {
          if (el.src !== manifestUrl) {
            el.src = manifestUrl;
            // Preload first few seconds immediately
            el.preload = 'auto';
          }
          try { 
            await el.play().catch((error) => {
              console.log('⚠️ Native HLS play failed:', error);
            }); 
          } catch {}
        } else {
          try { el.pause(); } catch {}
          // Switch back to metadata preload to save bandwidth
          el.preload = 'metadata';
        }
        return;
      }

      // hls.js path
      try {
        console.log('🔧 Loading HLS.js module');
        const HlsMod = await getHlsModule();
        if (cancelled) return;

        // create once with optimized settings
        if (!hlsRef.current) {
          console.log('🆕 Creating new HLS instance');
          hlsRef.current = createHlsInstance(HlsMod);
          hlsRef.current.attachMedia(el);
          
          // Add error handling
          hlsRef.current.on(HlsMod.default.Events.ERROR, (event: any, data: any) => {
            console.error('❌ HLS Error:', data);
            if (data.fatal) {
              console.error('💀 Fatal HLS error, destroying instance');
              hlsRef.current?.destroy();
              hlsRef.current = null;
            }
          });
        }

        // swap source only when visible to avoid unnecessary network
        if (visible) {
          console.log('👁️ Video is visible, loading source');
          hlsRef.current.loadSource(manifestUrl);
          // Trigger immediate buffer start for faster playback
          hlsRef.current.startLoad(0);
          // play may fail silently due to autoplay policy; that's ok
          try { 
            await el.play().catch((error) => {
              console.log('⚠️ HLS.js play failed:', error);
            }); 
          } catch {}
        } else {
          try { el.pause(); } catch {}
          // Stop loading to save bandwidth when not visible
          hlsRef.current.stopLoad();
        }
      } catch (error) {
        console.error('💥 Failed to set up HLS:', error);
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