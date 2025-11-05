import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { BrandedSpinner } from '../BrandedSpinner';
import { extractMuxPlaybackId, posterUrl } from "@/lib/video/muxClient";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type MuxPlayerRefElement = React.ElementRef<typeof MuxPlayer>;

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
}

export function VideoMedia({ url, post, visible, trackVideoProgress, globalSoundEnabled }: VideoMediaProps) {
  // ALWAYS start muted for reliable autoplay on iOS/mobile
  const [muted, setMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasBeenVisible, setHasBeenVisible] = useState(visible); // ✅ Track if ever visible
  const playerRef = useRef<MuxPlayerRefElement | null>(null);
  const viewTrackedRef = useRef(false);
  const playTrackedRef = useRef(false);
  const completeTrackedRef = useRef(false);
  const previousGlobalSound = useRef<boolean | undefined>(globalSoundEnabled);

  const playbackId = useMemo(() => extractMuxPlaybackId(url), [url]);
  const muxEnvKey = import.meta.env.VITE_MUX_DATA_ENV_KEY ?? "5i41hf91q117pfu1fgli0glfs";
  const muxBeaconDomain = import.meta.env.VITE_MUX_BEACON_DOMAIN;

  // ✅ OPTIMIZATION: Mark as visible immediately (no lazy loading delay for videos)
  // Videos need to preload to play instantly on scroll
  useEffect(() => {
    if (!hasBeenVisible) {
      setHasBeenVisible(true);
    }
  }, [hasBeenVisible]);

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
        console.debug("📉 Failed to send Mux engagement", error);
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
          // Avoid spamming analytics with frequent updates, but capture completion events.
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
      
      // ✅ OPTIMIZATION: Immediate play attempt (don't wait for isReady)
      const attemptPlay = async () => {
        try {
          // Force load if not already loading
          if (el.readyState < 2) {
            el.load();
          }
          await el.play();
          setIsPlaying(true);
          setIsReady(true);
        } catch (err) {
          console.debug("▶️ Autoplay blocked or play() rejected:", err);
          setIsPlaying(false);
        }
      };

      // Try to play immediately, don't wait for isReady
      attemptPlay();
    } else {
      el.pause();
      el.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      setIsBuffering(false);
      viewTrackedRef.current = false;
      playTrackedRef.current = false;
      completeTrackedRef.current = false;
    }
  }, [visible, muted]);

  useEffect(() => {
    if (globalSoundEnabled === undefined) return;
    if (previousGlobalSound.current === globalSoundEnabled) return;

    previousGlobalSound.current = globalSoundEnabled;
    const el = playerRef.current;
    const nextMuted = !globalSoundEnabled;

    // ✅ OPTIMIZATION: Immediate state update (no delay)
    setMuted(nextMuted);

    if (el) {
      // ✅ OPTIMIZATION: Use requestAnimationFrame for smooth audio transition
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
    const el = playerRef.current;
    if (!el) return;
    const next = !muted;
    setMuted(next);
    el.muted = next;
    if (!next) {
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
      <div className="w-full aspect-[9/16] max-h-[80vh] rounded-3xl bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Invalid video URL</p>
      </div>
    );
  }

  const title = `Post by ${post?.user_profiles?.display_name ?? "User"}`;
  const viewerId = post?.author_user_id ?? undefined;
  const poster = posterUrl({ playbackId }, { time: 1, width: 720, fitMode: "preserve" });

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-3xl bg-background aspect-[9/16] max-h-[82vh] shadow-xl",
        "group"
      )}
    >
      <div className="absolute inset-0 z-20 cursor-pointer" onClick={handleTogglePlayback} aria-hidden="true" />

      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        streamType="on-demand"
        autoPlay="muted"
        muted={muted}
        loop
        playsInline
        nocast
        preload="auto"
        crossOrigin="anonymous"
        poster={poster}
        preferCmcd
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
          player_name: "YardPass Feed",
        }}
        style={{ 
          width: "100%", 
          height: "100%", 
          objectFit: "cover", 
          backgroundColor: "black",
          // ✅ OPTIMIZATION: Hardware acceleration for smoother playback
          willChange: visible ? 'transform' : 'auto',
        }}
        className="pointer-events-none h-full w-full"
        onLoadStart={() => {
          setIsReady(false);
          setIsBuffering(true);
        }}
        onLoadedMetadata={() => {
          setIsReady(true);
          setIsBuffering(false);
        }}
        onPlay={() => {
          setIsPlaying(true);
          setIsReady(true);
          setIsBuffering(false);
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
          const el = playerRef.current;
          if (el) setMuted(el.muted);
        }}
        onError={(e) => console.error("❌ Mux player error:", playbackId, e)}
      />

      <div className="absolute inset-x-0 top-0 h-1 bg-muted/30">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {isBuffering && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <BrandedSpinner size="lg" className="text-foreground" />
        </div>
      )}

      {post?.user_profiles?.display_name && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background via-background/60 to-transparent px-5 pb-5 pt-20">
          <p className="text-base font-bold text-foreground drop-shadow-lg">
            {post.user_profiles.display_name}
          </p>
          {post?.text && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-foreground/90 drop-shadow-md">{post.text}</p>
          )}
        </div>
      )}
    </div>
  );
}
