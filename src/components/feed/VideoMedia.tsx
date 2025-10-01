import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Bookmark } from 'lucide-react';
import { extractMuxPlaybackId } from '@/utils/mux';
import MuxPlayer from '@mux/mux-player-react';

type MuxPlayerRefElement = React.ElementRef<typeof MuxPlayer>;

export function VideoMedia({
  url,
  post,
  visible,
  onAttachAnalytics,
}: {
  url: string;
  post: any;
  visible: boolean;
  onAttachAnalytics?: (v: HTMLVideoElement) => VoidFunction | void;
}) {
  const [muted, setMuted] = useState(true);
  const playerRef = useRef<MuxPlayerRefElement | null>(null);

  // Extract Mux playback ID from URL (supports mux:ABC or stream.mux.com/ABC)
  const playbackId = useMemo(() => {
    const id = extractMuxPlaybackId(url);
    console.log('🎥 Extracted Mux playback ID:', { url, playbackId: id });
    return id;
  }, [url]);

  // Mux Player handles analytics automatically via envKey

  // Control playback based on visibility
  useEffect(() => {
    const muxPlayer = playerRef.current;
    if (!muxPlayer) return;
    
    if (visible) {
      muxPlayer.muted = muted;
      muxPlayer.play().catch(() => {});
    } else {
      try { muxPlayer.pause(); } catch {}
    }
  }, [visible, muted]);

  if (!playbackId) {
    return (
      <div className="w-full max-h-80 rounded-lg bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Invalid video URL</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        envKey="5i41hf91q117pfu1fgli0glfs"
        streamType="on-demand"
        autoPlay={visible ? "muted" : false}
        muted={muted}
        loop
        style={{
          width: '100%',
          maxHeight: '320px',
          objectFit: 'cover',
          borderRadius: '0.5rem',
        }}
        className="relative z-20"
        metadata={{
          video_id: playbackId,
          video_title: `Post by ${post?.user_profiles?.display_name ?? 'User'}`,
          viewer_user_id: post?.author_user_id,
        }}
        onLoadStart={() => console.log('🎬 Mux: Load started -', playbackId)}
        onLoadedMetadata={() => console.log('📊 Mux: Metadata loaded -', playbackId)}
        onPlay={() => console.log('▶️ Mux: Playing -', playbackId)}
        onPlaying={() => console.log('▶️ Mux: Playback active -', playbackId)}
        onTimeUpdate={(e) => {
          const target = e.target as HTMLVideoElement;
          if (target.currentTime > 0 && target.currentTime < 1) {
            console.log('⏱️ Mux: First second played -', playbackId);
          }
        }}
        onError={(e) => console.error('❌ Mux player error:', playbackId, e)}
      />

      <div className="absolute top-2 right-2 flex flex-col gap-2 z-30">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const player = playerRef.current;
            if (!player) return;
            const next = !muted;
            setMuted(next);
            player.muted = next;
          }}
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm rounded-full"
          aria-label={muted ? 'Unmute video' : 'Mute video'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm rounded-full"
          aria-label="Bookmark post"
        >
          <Bookmark className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}