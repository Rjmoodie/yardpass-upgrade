import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { BrandedSpinner } from '../BrandedSpinner';
import { extractMuxPlaybackId, posterUrl } from "@/lib/video/muxClient";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { logVideoError, logVideoMetric, createVideoContext } from "@/utils/videoLogger";
import { logger } from "@/utils/logger";
import { Volume2, VolumeX } from "lucide-react";

// 🎯 Lazy-load Mux Player (saves ~78 KB from initial bundle)
const MuxPlayer = lazy(() => import("@mux/mux-player-react").then(m => ({ default: m.default })));

type MuxPlayerRefElement = any;

interface VideoMediaProps {
  url: string;
  post: {
    id?: string;
    event_id?: string;
    author_user_id?: string;
    user_profiles?: { display_name?: string | null };
    text?: string | null;
  };
  visible: boolean;
  trackVideoProgress?: (postId: string, eventId: string, video: HTMLVideoElement) => void;
  globalSoundEnabled?: boolean;
  hideCaption?: boolean; // Hide the built-in caption overlay (for use in viewers that have their own)
  hideControls?: boolean; // Hide the mute button (for use with native video controls)
}

export function VideoMedia({ url, post, visible, trackVideoProgress, globalSoundEnabled, hideCaption = false, hideControls = false }: VideoMediaProps) {
  // ALWAYS start muted for reliable autoplay on iOS/mobile
  const [muted, setMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasBeenVisible, setHasBeenVisible] = useState(visible);
  
  const playerRef = useRef<MuxPlayerRefElement | null>(null);
  const viewTrackedRef = useRef(false);
  const playTrackedRef = useRef(false);
  const completeTrackedRef = useRef(false);
  const previousGlobalSound = useRef<boolean | undefined>(globalSoundEnabled);
  
  // Performance tracking
  const loadStartTimeRef = useRef<number | null>(null);
  const firstFrameTimeRef = useRef<number | null>(null);
  const playStartTimeRef = useRef<number | null>(null);

  const playbackId = useMemo(() => extractMuxPlaybackId(url), [url]);
  const muxEnvKey = import.meta.env.VITE_MUX_DATA_ENV_KEY ?? "5i41hf91q117pfu1fgli0glfs";
  const muxBeaconDomain = import.meta.env.VITE_MUX_BEACON_DOMAIN;

  const containerRef = useRef<HTMLDivElement>(null);
  
  // ✅ IntersectionObserver for visibility detection
  useEffect(() => {
    if (visible) {
      if (!hasBeenVisible) {
        setHasBeenVisible(true);
      }
      return;
    }

    if (!containerRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isNearViewport = entry.isIntersecting || entry.intersectionRatio > 0;
        if (isNearViewport && !hasBeenVisible) {
          setHasBeenVisible(true);
        }
      },
      {
        rootMargin: '200px',
        threshold: [0, 0.1],
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [visible, hasBeenVisible]);

  const sendMuxEngagement = useCallback(
    async (eventType: string, detail: Record<string, any> | undefined) => {
      if (!post?.id || !post?.event_id || !playbackId) return;
      try {
        await supabase.functions.invoke("track-analytics", {
          body: {
            type: "mux_engagement",
            data: {
              event_type: eventType,
              post_id: post.id,
              event_id: post.event_id,
              playback_id: playbackId,
              detail,
            },
          },
        });
      } catch (error) {
        logger.debug("📉 Failed to send Mux engagement", error);
      }
    },
    [playbackId, post?.event_id, post?.id]
  );

  useEffect(() => {
    const el = playerRef.current;
    if (!el || !playbackId) return;

    const onMuxData = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail?.type) return;
      switch (detail.type) {
        case "video_view":
          if (!viewTrackedRef.current) {
            viewTrackedRef.current = true;
            sendMuxEngagement("video_view", detail);
          }
          break;
        case "video_play":
          if (!playTrackedRef.current) {
            playTrackedRef.current = true;
            sendMuxEngagement("video_play", detail);
          }
          break;
        case "video_quartile":
          if (detail?.quartile === "Q4" && !completeTrackedRef.current) {
            completeTrackedRef.current = true;
            sendMuxEngagement("video_complete", detail);
          }
          break;
        default:
          break;
      }
    };

    el.addEventListener("mux-data-event", onMuxData as EventListener);
    return () => {
      el.removeEventListener("mux-data-event", onMuxData as EventListener);
    };
  }, [playbackId, sendMuxEngagement]);

  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;

    if (visible) {
      el.muted = muted;
      
      const attemptPlay = async () => {
        try {
          if (el.readyState < 2) {
            el.load();
          }
          await el.play();
          setIsPlaying(true);
          setIsReady(true);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          
          if (error.name === 'AbortError' || error.message.includes('interrupted by a new load request')) {
            setIsPlaying(false);
            return;
          }
          
          const isAutoplayBlocked = error.message.includes('play') || error.name === 'NotAllowedError';
          
          if (isAutoplayBlocked) {
            logVideoError({
              type: 'autoplay_blocked',
              playbackId,
              url,
              error,
              context: {
                ...createVideoContext(el as unknown as HTMLVideoElement, playbackId, post?.id, post?.event_id),
              },
            });
          } else {
            logVideoError({
              type: 'playback_error',
              playbackId,
              url,
              error,
              context: {
                ...createVideoContext(el as unknown as HTMLVideoElement, playbackId, post?.id, post?.event_id),
              },
            });
          }
          
          setIsPlaying(false);
        }
      };

      attemptPlay();
    } else {
      requestAnimationFrame(() => {
        if (el && !visible) {
          el.pause();
          el.currentTime = 0;
          setIsPlaying(false);
          setProgress(0);
          setIsBuffering(false);
          viewTrackedRef.current = false;
          playTrackedRef.current = false;
          completeTrackedRef.current = false;
        }
      });
    }
  }, [visible, muted]);

  useEffect(() => {
    if (globalSoundEnabled === undefined) return;
    if (previousGlobalSound.current === globalSoundEnabled) return;

    previousGlobalSound.current = globalSoundEnabled;
    const el = playerRef.current;
    const nextMuted = !globalSoundEnabled;

    setMuted(nextMuted);

    if (el) {
      requestAnimationFrame(() => {
        el.muted = nextMuted;
        if (!nextMuted && visible) {
          el.play().catch(() => {});
        }
      });
    }
  }, [globalSoundEnabled, visible]);

  useEffect(() => {
    if (!trackVideoProgress || !post?.id || !post?.event_id) return;
    const el = playerRef.current as unknown as HTMLVideoElement | null;
    if (!el) return;

    return trackVideoProgress(post.id, post.event_id, el);
  }, [trackVideoProgress, post?.id, post?.event_id, playbackId]);

  const handleToggleMute = useCallback(() => {
    const el = playerRef.current as HTMLVideoElement | null;
    if (!el) return;
    const next = !muted;
    setMuted(next);
    el.muted = next;
    
    // When unmuting, ensure volume is audible and playback resumes
    if (!next) {
      if (el.volume < 0.1) {
        el.volume = 1;
      }
      el.play().catch(() => {});
    }
  }, [muted]);

  const handleTogglePlayback = useCallback(() => {
    const el = playerRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleTimeUpdate = useCallback((event: Event) => {
    const target = event.currentTarget as HTMLVideoElement | null;
    if (!target || !target.duration) return;
    setProgress((target.currentTime / target.duration) * 100);
  }, []);

  if (!playbackId) {
    return (
      <div className="h-full w-full bg-black flex items-center justify-center sm:rounded-3xl">
        <p className="text-muted-foreground">Invalid video URL</p>
      </div>
    );
  }

  const title = `Post by ${post?.user_profiles?.display_name ?? "User"}`;
  const viewerId = post?.author_user_id ?? undefined;
  const poster = posterUrl({ playbackId }, { time: 1, width: 720, fitMode: "preserve" });

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden bg-black group",
        "sm:rounded-3xl sm:shadow-xl"
        // ✅ Removed touch-none - allows normal scrolling
      )}
    >
      {/* Transparent tap area for play/pause - doesn't block scrolling */}
      <div 
        className="absolute inset-0 z-20"
        onClick={handleTogglePlayback}
        aria-hidden="true"
      />

      {/* 🎯 Lazy-loaded Mux player */}
      <Suspense fallback={
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <BrandedSpinner size="sm" text="Loading video..." />
        </div>
      }>
        <MuxPlayer
          ref={playerRef}
          playbackId={playbackId}
          streamType="on-demand"
          autoPlay="muted"
          muted={muted}
          loop
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          poster={poster}
          preferCmcd={true as any}
          envKey={muxEnvKey}
          beaconCollectionDomain={muxBeaconDomain}
          metadata={{
            video_id: playbackId,
            video_title: title,
            video_series: post?.event_id ? `event:${post.event_id}` : undefined,
            video_series_id: post?.event_id,
            viewer_user_id: viewerId,
            custom_1: post?.id,
            custom_2: post?.text ?? undefined,
            player_name: "Liventix Feed",
          }}
          style={{ 
            width: "100%", 
            height: "100%", 
            objectFit: "cover", 
            backgroundColor: "black",
            willChange: visible ? 'transform' : 'auto',
          }}
          className="pointer-events-none h-full w-full"
          onLoadStart={() => {
            setIsReady(false);
            setIsBuffering(true);
            loadStartTimeRef.current = performance.now();
          }}
          onLoadedMetadata={() => {
            setIsReady(true);
            setIsBuffering(false);
            
            if (loadStartTimeRef.current) {
              const timeToMetadata = performance.now() - loadStartTimeRef.current;
              if (!firstFrameTimeRef.current) {
                firstFrameTimeRef.current = performance.now();
                logVideoMetric({
                  metric: 'time_to_first_frame',
                  playbackId,
                  url,
                  value: timeToMetadata,
                  context: {
                    postId: post?.id,
                    eventId: post?.event_id,
                  },
                });
              }
            }
          }}
          onPlay={() => {
            setIsPlaying(true);
            setIsReady(true);
            setIsBuffering(false);
            
            if (loadStartTimeRef.current) {
              const timeToPlay = performance.now() - loadStartTimeRef.current;
              if (!playStartTimeRef.current) {
                playStartTimeRef.current = performance.now();
                logVideoMetric({
                  metric: 'time_to_play',
                  playbackId,
                  url,
                  value: timeToPlay,
                  context: {
                    postId: post?.id,
                    eventId: post?.event_id,
                  },
                });
              }
            }
          }}
          onPause={() => setIsPlaying(false)}
          onPlaying={() => {
            setIsPlaying(true);
            setIsBuffering(false);
          }}
          onWaiting={() => setIsBuffering(true)}
          onEnded={() => {
            completeTrackedRef.current = false;
            playTrackedRef.current = false;
          }}
          onTimeUpdate={handleTimeUpdate}
          onVolumeChange={() => {
            const el = playerRef.current as HTMLVideoElement | null;
            if (!el) return;
            
            const nowMuted = el.muted;
            setMuted(nowMuted);
            
            // iOS quirk: after unmuting, ensure volume is up and call play()
            if (!nowMuted) {
              // Ensure volume is audible (not just unmuted but at 0 volume)
              if (el.volume < 0.1) {
                el.volume = 1;
              }
              // If paused, resume playback for audio to work
              if (el.paused) {
                el.play().catch(() => {});
              }
            }
          }}
          onError={(e) => {
            const videoElement = playerRef.current as unknown as HTMLVideoElement | null;
            logVideoError({
              type: 'playback_error',
              playbackId,
              url,
              error: e instanceof Error ? e : new Error(String(e)),
              context: {
                ...createVideoContext(videoElement, playbackId, post?.id, post?.event_id),
              },
            });
          }}
        />
      </Suspense>

      {/* Progress bar - thin and unobtrusive */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-muted/30 z-25">
        <div 
          className="h-full bg-primary transition-[width] duration-200" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      {/* Buffering overlay */}
      {isBuffering && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 pointer-events-none">
          <BrandedSpinner size="lg" className="text-foreground" />
        </div>
      )}

      {/* Mute/unmute button - always visible on mobile for easy access (hidden when hideControls is true) */}
      {!hideControls && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleMute();
          }}
          className={cn(
            "absolute bottom-4 right-4 z-30",
            "flex h-9 w-9 items-center justify-center rounded-full",
            "bg-black/50 text-white backdrop-blur-sm transition-all",
            "hover:bg-black/70 active:scale-95"
          )}
          aria-label={muted ? "Unmute video" : "Mute video"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}

      {/* Caption overlay - simplified (hidden when hideCaption is true) */}
      {!hideCaption && post?.user_profiles?.display_name && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-14 pt-16">
          <p className="text-sm font-semibold text-white drop-shadow-md">
            {post.user_profiles.display_name}
          </p>
          {post?.text && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/85 drop-shadow">
              {post.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
