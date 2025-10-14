import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { Button } from "@/components/ui/button";
import { Bookmark, Pause, Play, Volume2, VolumeX } from "lucide-react";
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
}

export function VideoMedia({ url, post, visible, trackVideoProgress }: VideoMediaProps) {
  const [muted, setMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTapHint, setShowTapHint] = useState(true);
  const playerRef = useRef<MuxPlayerRefElement | null>(null);
  const viewTrackedRef = useRef(false);
  const playTrackedRef = useRef(false);
  const completeTrackedRef = useRef(false);

  const playbackId = useMemo(() => extractMuxPlaybackId(url), [url]);
  const muxEnvKey = import.meta.env.VITE_MUX_DATA_ENV_KEY ?? "5i41hf91q117pfu1fgli0glfs";
  const muxBeaconDomain = import.meta.env.VITE_MUX_BEACON_DOMAIN;

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
      const attemptPlay = async () => {
        try {
          await el.play();
          setIsPlaying(true);
        } catch (err) {
          console.debug("▶️ Autoplay blocked or play() rejected:", err);
          setIsPlaying(false);
        }
      };

      if (isReady) {
        attemptPlay();
      }
    } else {
      el.pause();
      el.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
      setShowTapHint(true);
      setIsBuffering(false);
      viewTrackedRef.current = false;
      playTrackedRef.current = false;
      completeTrackedRef.current = false;
    }
  }, [visible, muted, isReady]);

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
      setShowTapHint(false);
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
        "relative w-full overflow-hidden rounded-3xl bg-black aspect-[9/16] max-h-[82vh] shadow-xl",
        "group"
      )}
    >
      <div className="absolute inset-0 z-20 cursor-pointer" onClick={handleTogglePlayback} aria-hidden="true" />

      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        streamType="on-demand"
        autoPlay={visible ? "muted" : false}
        muted={muted}
        loop
        playsInline
        preload="metadata"
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
        style={{ width: "100%", height: "100%", objectFit: "cover", backgroundColor: "black" }}
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

      <div className="absolute inset-x-0 top-0 h-1 bg-white/20">
        <div className="h-full bg-white transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {isBuffering && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <BrandedSpinner size="lg" className="text-white" />
        </div>
      )}

      {muted && showTapHint && (
        <div className="absolute bottom-24 left-4 z-30">
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            Tap for sound
          </span>
        </div>
      )}

      {post?.user_profiles?.display_name && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4">
          <p className="text-sm font-semibold text-white">
            {post.user_profiles.display_name}
          </p>
          {post?.text && (
            <p className="mt-1 line-clamp-2 text-xs text-white/80">{post.text}</p>
          )}
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleTogglePlayback}
          className="pointer-events-auto h-9 w-9 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
          aria-label={isPlaying ? "Pause video" : "Play video"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleMute}
          className="pointer-events-auto h-9 w-9 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
          aria-label={muted ? "Unmute video" : "Mute video"}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-9 w-9 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70"
          aria-label="Bookmark post"
        >
          <Bookmark className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
