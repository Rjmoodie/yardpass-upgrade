import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Bookmark } from 'lucide-react';
import { muxToPoster, buildMuxUrl } from '@/utils/mux';
import { useSmartHlsVideo } from '@/hooks/useSmartHlsVideo';

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
  const manifest = useMemo(() => {
    const muxUrl = buildMuxUrl(url);
    if (muxUrl?.includes('stream.mux.com')) {
      return `${muxUrl}?redundant_streams=true`;
    }
    return muxUrl || url;
  }, [url]);
  const poster = useMemo(() => muxToPoster(url, 'fit_mode=smartcrop&time=1'), [url]);

  const { videoRef } = useSmartHlsVideo(manifest, visible);

  // attach analytics once the videoRef is ready & visible
  React.useEffect(() => {
    if (!visible || !videoRef.current) return;
    const cleanup = onAttachAnalytics?.(videoRef.current);
    return () => cleanup && cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, videoRef.current]);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        className="w-full max-h-80 object-cover rounded-lg"
        playsInline
        muted={muted}
        preload="metadata"
        poster={poster}
        aria-label={`Video in post by ${post.user_profiles?.display_name ?? 'User'}`}
        controls={false}
      />
      <div className="absolute top-2 right-2 flex flex-col gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            const next = !muted;
            setMuted(next);
            v.muted = next;
          }}
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm rounded-full"
          aria-label={muted ? 'Unmute video' : 'Mute video'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm rounded-full" aria-label="Bookmark post">
          <Bookmark className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}