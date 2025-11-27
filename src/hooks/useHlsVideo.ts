// src/hooks/useHlsVideo.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { logVideoError, logVideoMetric, createVideoContext } from '@/utils/videoLogger';
import { createFeatureLogger } from '@/utils/logger';

const videoLogger = createFeatureLogger('video');

export function useHlsVideo(src?: string) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    // Cleanup HLS instance first
    if (hlsRef.current) {
      try {
        const hls = hlsRef.current;
        
        // Detach from media element first (prevents further operations)
        if (videoRef.current) {
          try {
            hls.detachMedia();
          } catch (e) {
            // Ignore detach errors
          }
        }
        
        // Stop loading to prevent new requests
        try {
          hls.stopLoad();
        } catch (e) {
          // Ignore stopLoad errors
        }
        
        // Remove all event listeners (HLS.js removes listeners on destroy, but we do it explicitly for safety)
        try {
          // Get HLS Events from the instance if available
          const HlsEvents = (hls as any).constructor?.Events;
          if (HlsEvents) {
            hls.off(HlsEvents.MANIFEST_PARSED);
            hls.off(HlsEvents.ERROR);
            hls.off(HlsEvents.MEDIA_ATTACHED);
            hls.off(HlsEvents.MEDIA_DETACHED);
            hls.off(HlsEvents.FRAG_LOADED);
            hls.off(HlsEvents.LEVEL_LOADED);
          }
        } catch (e) {
          // Event removal is best-effort
        }
        
        // Destroy the instance
        hls.destroy();
        hlsRef.current = null;
      } catch (e) {
        // Log cleanup errors for debugging
        videoLogger.warn('Error destroying HLS instance:', e);
        // Force null even if destroy fails
        hlsRef.current = null;
      }
    }
    
    // Cleanup video element
    const v = videoRef.current;
    if (v) {
      try {
        // Pause and reset playback
        v.pause();
        v.currentTime = 0;
        
        // Remove all event listeners
        v.onloadedmetadata = null;
        v.onerror = null;
        v.oncanplay = null;
        v.oncanplaythrough = null;
        v.onplay = null;
        v.onpause = null;
        v.onended = null;
        v.ontimeupdate = null;
        v.onwaiting = null;
        v.onstalled = null;
        v.onloadstart = null;
        v.onloadeddata = null;
        
        // Remove src and clear buffer
        v.removeAttribute('src');
        v.src = '';
        v.srcObject = null;
        
        // Force reload to clear buffer
        v.load();
      } catch (e) {
        videoLogger.warn('Error cleaning up video element:', e);
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
        videoLogger.debug('Starting video setup for:', src, 'iOS:', isIOS, 'canPlayNative:', canPlayNative);
        
        // iOS Safari supports HLS natively - prefer that over HLS.js
        if (isHls && canPlayNative) {
          videoLogger.debug('Using native HLS for iOS:', src);
          v.src = src;
          v.onloadedmetadata = () => {
            videoLogger.debug('Native iOS HLS metadata loaded for:', src);
            if (!disposed) setReady(true);
          };
          v.onerror = (e) => {
            const playbackId = src.match(/mux\.com\/([^/]+)/)?.[1];
            logVideoError({
              type: 'playback_error',
              playbackId,
              url: src,
              error: new Error('Native iOS HLS playback error'),
              context: {
                ...createVideoContext(v),
                readyState: v.readyState,
                networkState: v.networkState,
              },
            });
            if (!disposed) setError('Video playback error');
          };
        } else if (isHls && !canPlayNative) {
          const Hls = (await import('hls.js')).default;
          videoLogger.debug('HLS.js loaded, isSupported:', Hls.isSupported());
          
          if (Hls.isSupported()) {
            videoLogger.debug('Using HLS.js for:', src);
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
              videoLogger.debug('Manifest parsed for:', src);
              if (!disposed) setReady(true);
            });
            
            hls.on(Hls.Events.ERROR, (event, data) => {
              const playbackId = src.match(/mux\.com\/([^/]+)/)?.[1];
              
              if (data.fatal) {
                const errorType = data.type === Hls.ErrorTypes.NETWORK_ERROR
                  ? 'hls_network_error'
                  : data.type === Hls.ErrorTypes.MEDIA_ERROR
                  ? 'hls_media_error'
                  : 'hls_fatal_error';
                
                logVideoError({
                  type: errorType as any,
                  playbackId,
                  url: src,
                  error: new Error(`HLS fatal error: ${data.type}`),
                  context: {
                    ...createVideoContext(v, playbackId),
                    hlsErrorType: data.type,
                    hlsErrorDetails: {
                      details: data.details,
                      fatal: data.fatal,
                      reason: data.reason,
                    },
                  },
                });
                
                if (!disposed) {
                  setError(`HLS fatal error: ${data.type}`);
                  setReady(false);
                }
                switch (data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    videoLogger.debug('Fatal network error, trying to recover');
                    hls.startLoad();
                    break;
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    videoLogger.debug('Fatal media error, trying to recover');
                    hls.recoverMediaError();
                    break;
                  default:
                    videoLogger.debug('Fatal error, cannot recover');
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
              const playbackId = src.match(/mux\.com\/([^/]+)/)?.[1];
              logVideoError({
                type: 'playback_error',
                playbackId,
                url: src,
                error: new Error('Native video playback error'),
                context: {
                  ...createVideoContext(v, playbackId),
                },
              });
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
            videoLogger.debug('Native video metadata loaded for:', src);
            if (!disposed) setReady(true);
          };
          v.onerror = (e) => {
            const playbackId = src.match(/mux\.com\/([^/]+)/)?.[1];
            logVideoError({
              type: 'playback_error',
              playbackId,
              url: src,
              error: new Error('Native video playback error'),
              context: {
                ...createVideoContext(v, playbackId),
              },
            });
            if (!disposed) setError('Native video playback error');
          };
        }
      } catch (e) {
        const playbackId = src.match(/mux\.com\/([^/]+)/)?.[1];
        const error = e instanceof Error ? e : new Error(String(e));
        
        logVideoError({
          type: 'load_error',
          playbackId,
          url: src,
          error,
          context: {
            ...createVideoContext(v, playbackId),
          },
        });
        
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