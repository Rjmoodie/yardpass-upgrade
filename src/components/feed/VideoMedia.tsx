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
}: {
  url: string;
  post: any;
  visible: boolean;
}) {
  const [muted, setMuted] = useState(true);
  const playerRef = useRef<MuxPlayerRefElement | null>(null);

  // Extract Mux playback ID from URL (supports mux:ABC or stream.mux.com/ABC)
  const playbackId = useMemo(() => {
    const id = extractMuxPlaybackId(url);
    console.log('🎥 Extracted Mux playback ID:', { url, playbackId: id });
    return id;
  }, [url]);

  // Visibility-driven playback (handle autoplay block gracefully)
  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;

    const playIfVisible = async () => {
      try {
        if (visible) {
          el.muted = muted;
          await el.play();
        } else {
          el.pause();
        }
      } catch (err) {
        console.debug('▶️ Autoplay blocked or play() rejected:', err);
      }
    };

    playIfVisible();
  }, [visible, muted]);

  // Observe Mux Data events for debugging
  useEffect(() => {
    const el = playerRef.current as unknown as HTMLElement | null;
    if (!el) return;

    const onMuxData = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      console.log('📈 mux-data-event:', detail?.type, detail);
    };

    el.addEventListener('mux-data-event', onMuxData as EventListener);
    return () => el.removeEventListener('mux-data-event', onMuxData as EventListener);
  }, []);

  if (!playbackId) {
    return (
      <div className="w-full max-h-80 rounded-lg bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Invalid video URL</p>
      </div>
    );
  }

  const title = `Post by ${post?.user_profiles?.display_name ?? 'User'}`;
  const viewerId = post?.author_user_id ?? undefined;

  return (
    <div className="relative">
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
        envKey={import.meta.env.VITE_MUX_DATA_ENV_KEY ?? '5i41hf91q117pfu1fgli0glfs'}
        metadata={{
          video_id: playbackId,
          video_title: title,
          viewer_user_id: viewerId,
        }}
        style={{
          width: '100%',
          maxHeight: '320px',
          objectFit: 'cover',
          borderRadius: '0.5rem',
        }}
        className="relative z-20"
        onLoadStart={() => console.log('🎬 Mux: Load started -', playbackId)}
        onLoadedMetadata={() => console.log('📊 Mux: Metadata loaded -', playbackId)}
        onPlay={() => console.log('▶️ Mux: Playing -', playbackId)}
        onError={(e) => console.error('❌ Mux player error:', playbackId, e)}
      />

      <div className="absolute top-2 right-2 flex flex-col gap-2 z-30">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const el = playerRef.current;
            if (!el) return;
            const next = !muted;
            setMuted(next);
            el.muted = next;
            if (!next) {
              el.play().catch(() => {});
            }
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