// src/hooks/useHlsVideo.ts
import { useEffect, useRef, useState, useCallback } from 'react';

export function useHlsVideo(src?: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
        hlsRef.current = null;
      } catch (e) {
        if (import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.warn('useHlsVideo: Error destroying HLS instance:', e);
        }
      }
    }
    
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.removeAttribute('src');
        v.onloadedmetadata = null;
        v.onerror = null;
        v.load();
      } catch (e) {
        if (import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.warn('useHlsVideo: Error cleaning up video element:', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) {
      setReady(false);
      setError(null);
      return;
    }

    setReady(false);
    setError(null);
    cleanup();

    const isHls = src.includes('.m3u8');
    const canPlayNative = v.canPlayType('application/vnd.apple.mpegurl') !== '';
    
    // iOS-specific: Ensure proper attributes are set
    const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      v.setAttribute('playsinline', 'true');
      v.setAttribute('webkit-playsinline', 'true');
      v.setAttribute('x5-playsinline', 'true');
    }

    let disposed = false;

    (async () => {
      try {
        if (import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.debug('useHlsVideo: Starting video setup for:', src, 'iOS:', isIOS, 'canPlayNative:', canPlayNative);
        }
        
        // iOS Safari supports HLS natively - prefer that over HLS.js
        if (isHls && canPlayNative) {
          if (import.meta.env?.DEV) {
            // eslint-disable-next-line no-console
            console.debug('useHlsVideo: Using native HLS for iOS:', src);
          }
          v.src = src;
          v.onloadedmetadata = () => {
            if (import.meta.env?.DEV) {
              // eslint-disable-next-line no-console
              console.debug('useHlsVideo: Native iOS HLS metadata loaded for:', src);
            }
            if (!disposed) setReady(true);
          };
          v.onerror = (e) => {
            console.error('useHlsVideo: Native iOS HLS error for:', src, e);
            if (!disposed) setError('Video playback error');
          };
        } else if (isHls && !canPlayNative) {
          const Hls = (await import('hls.js')).default;
          if (import.meta.env?.DEV) {
            // eslint-disable-next-line no-console
            console.debug('useHlsVideo: HLS.js loaded, isSupported:', Hls.isSupported());
          }
          
          if (Hls.isSupported()) {
            if (import.meta.env?.DEV) {
              // eslint-disable-next-line no-console
              console.debug('useHlsVideo: Using HLS.js for:', src);
            }
            const hls = new Hls({ 
              enableWorker: false, // Disable worker for better compatibility
              lowLatencyMode: false,
              backBufferLength: 30,
              maxBufferLength: 60,
              maxMaxBufferLength: 120,
              startFragPrefetch: true,
              testBandwidth: false,
              progressive: false,
              debug: false,
              capLevelToPlayerSize: true,
              startLevel: -1, // Auto quality
              autoStartLoad: true,
              maxLoadingDelay: 4,
              maxBufferHole: 0.5,
              liveSyncDurationCount: 3,
              liveMaxLatencyDurationCount: Infinity
            });
            
            hlsRef.current = hls;
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              if (import.meta.env?.DEV) {
                // eslint-disable-next-line no-console
                console.debug('useHlsVideo: Manifest parsed for:', src);
              }
              if (!disposed) setReady(true);
            });
            
            hls.on(Hls.Events.ERROR, (event, data) => {
              console.error('useHlsVideo: HLS error for:', src, event, data);
              if (data.fatal) {
                if (!disposed) {
                  setError(`HLS fatal error: ${data.type}`);
                  setReady(false);
                }
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    if (import.meta.env?.DEV) {
                      // eslint-disable-next-line no-console
                      console.debug('useHlsVideo: Fatal network error, trying to recover');
                    }
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    if (import.meta.env?.DEV) {
                      // eslint-disable-next-line no-console
                      console.debug('useHlsVideo: Fatal media error, trying to recover');
                    }
                    hls.recoverMediaError();
                    break;
                  default:
                    if (import.meta.env?.DEV) {
                      // eslint-disable-next-line no-console
                      console.debug('useHlsVideo: Fatal error, cannot recover');
                    }
                    hls.destroy();
                    break;
                }
              }
            });

            hls.loadSource(src);
            hls.attachMedia(v);
          } else {
            // Fallback to native
            if (import.meta.env?.DEV) {
              // eslint-disable-next-line no-console
              console.debug('useHlsVideo: HLS.js not supported, using native for:', src);
            }
            v.src = src;
            v.onloadedmetadata = () => {
              if (import.meta.env?.DEV) {
                // eslint-disable-next-line no-console
                console.debug('useHlsVideo: Native video metadata loaded for:', src);
              }
              if (!disposed) setReady(true);
            };
            v.onerror = (e) => {
              console.error('useHlsVideo: Native video error for:', src, e);
              if (!disposed) setError('Native video playback error');
            };
          }
        } else {
          if (import.meta.env?.DEV) {
            // eslint-disable-next-line no-console
            console.debug('useHlsVideo: Using native video for:', src, 'canPlayNative:', canPlayNative);
          }
          v.src = src;
          v.onloadedmetadata = () => {
            if (import.meta.env?.DEV) {
              // eslint-disable-next-line no-console
              console.debug('useHlsVideo: Native video metadata loaded for:', src);
            }
            if (!disposed) setReady(true);
          };
          v.onerror = (e) => {
            console.error('useHlsVideo: Native video error for:', src, e);
            if (!disposed) setError('Native video playback error');
          };
        }
      } catch (e) {
        console.error('useHlsVideo: Exception loading video for:', src, e);
        if (!disposed) {
          setError('Failed to load video');
          // Fallback attempt
          if (v) {
            v.src = src;
            v.onloadedmetadata = () => {
              if (!disposed) setReady(true);
            };
          }
        }
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [src, cleanup]);

  return { videoRef, ready, error };
}