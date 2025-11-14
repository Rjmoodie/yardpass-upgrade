import { useEffect, useRef, useState } from 'react';
import { getHlsModule, createHlsInstance } from '@/utils/hlsLoader';

export function useSmartHlsVideo(manifestUrl: string, visible: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const lastUrlRef = useRef<string | null>(null);
  const fatalCountRef = useRef(0);
  const [isIntersecting, setIsIntersecting] = useState(false);

  // IntersectionObserver for better visibility detection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Consider visible if > 50% is showing
        setIsIntersecting(entry.intersectionRatio > 0.5);
      },
      {
        threshold: [0, 0.5, 1.0],
        rootMargin: '50px', // Preload slightly before fully visible
      }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  // Combine prop-based visibility with IO detection
  const effectiveVisible = visible && isIntersecting;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const el = videoRef.current;
      if (!el || !manifestUrl) {
        if (import.meta.env.DEV) {
          console.log('🚫 Video element or manifest URL missing:', { hasElement: !!el, manifestUrl });
        }
        return;
      }

      // Make autoplay more reliable across mobile browsers
      el.muted = true;
      el.setAttribute('muted', '');
      el.playsInline = true;

      // Native HLS path (Safari)
      const canNative = !!el.canPlayType?.('application/vnd.apple.mpegurl');
      if (canNative) {
        if (effectiveVisible) {
          if (lastUrlRef.current !== manifestUrl) {
            el.src = manifestUrl;
            el.preload = 'auto';
            // Commit the new src quickly
            try { el.load?.(); } catch {}
            lastUrlRef.current = manifestUrl;
          }
          // Try play now; also try again after canplay
          const tryPlay = () => el.play().catch(() => {});
          tryPlay();
          const onCanPlay = () => { tryPlay(); el.removeEventListener('canplay', onCanPlay); };
          el.addEventListener('canplay', onCanPlay);
          return () => el.removeEventListener('canplay', onCanPlay);
        } else {
          try { el.pause(); } catch {}
          el.preload = 'metadata'; // keep it cheap off-screen
        }
        return;
      }

      // hls.js path — only load module/instance if we actually need to show it
      if (!effectiveVisible) {
        // Off-screen: pause & stop downloads if we already have an instance
        try { el.pause(); } catch {}
        if (hlsRef.current) {
          try { hlsRef.current.stopLoad(); } catch {}
        } else {
          // No instance = nothing to do; avoid importing the module yet
          el.preload = 'metadata';
        }
        return;
      }

      // Visible: ensure instance exists and is attached
      try {
        const HlsMod = await getHlsModule();
        if (cancelled) return;

        // Create once with feed-friendly defaults
        if (!hlsRef.current) {
          if (import.meta.env.DEV) console.log('🆕 Creating HLS instance');
          hlsRef.current = createHlsInstance(HlsMod);

          hlsRef.current.attachMedia(el);

          // Errors: try to recover media once; destroy on fatal network or repeated fatals
          hlsRef.current.on(HlsMod.default.Events.ERROR, (_event: any, data: any) => {
            if (import.meta.env.DEV) console.error('❌ HLS Error:', data);
            if (!data?.fatal) return;

            if (data.type === HlsMod.default.ErrorTypes.NETWORK_ERROR) {
              // network fatals generally require a destroy/recreate
              try { hlsRef.current?.destroy(); } catch {}
              hlsRef.current = null;
              return;
            }

            // Media error: try to recover once, then bail if it keeps happening
            if (data.type === HlsMod.default.ErrorTypes.MEDIA_ERROR) {
              fatalCountRef.current += 1;
              if (fatalCountRef.current <= 1) {
                try { hlsRef.current?.recoverMediaError(); } catch {}
              } else {
                try { hlsRef.current?.destroy(); } catch {}
                hlsRef.current = null;
              }
            }
          });
        }

        // Only (re)load source if it changed
        if (lastUrlRef.current !== manifestUrl) {
          hlsRef.current.loadSource(manifestUrl);
          lastUrlRef.current = manifestUrl;
        }

        // Start fetching/buffering now that we're visible
        try { hlsRef.current.startLoad(0); } catch {}

        // Kick playback now and after canplay to satisfy some browsers
        const tryPlay = () => el.play().catch(() => {});
        tryPlay();
        const onCanPlay = () => { tryPlay(); el.removeEventListener('canplay', onCanPlay); };
        el.addEventListener('canplay', onCanPlay);

        return () => el.removeEventListener('canplay', onCanPlay);
      } catch (error) {
        if (import.meta.env.DEV) console.error('💥 Failed to set up HLS:', error);
      }
    })();

    return () => { cancelled = true; };
  }, [manifestUrl, effectiveVisible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { videoRef.current?.pause(); } catch {}
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
      lastUrlRef.current = null;
      fatalCountRef.current = 0;
    };
  }, []);

  return { videoRef };
}