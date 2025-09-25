import React, { useEffect, useMemo, useState } from 'react';
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
  const [ready, setReady] = useState(false);

  const manifest = useMemo(() => {
    const muxUrl = buildMuxUrl(url);
    console.log('🎬 Building manifest URL:', { originalUrl: url, muxUrl });
    if (muxUrl?.includes('stream.mux.com')) {
      const finalUrl = `${muxUrl}?redundant_streams=true`;
      console.log('📺 Final manifest URL:', finalUrl);
      return finalUrl;
    }
    console.log('🔄 Using original URL as manifest:', muxUrl || url);
    return muxUrl || url;
  }, [url]);

  const poster = useMemo(() => muxToPoster(url, 'fit_mode=smartcrop&time=1'), [url]);

  const { videoRef } = useSmartHlsVideo(manifest, visible);

  // Attach analytics safely (depend on ref object, not ref.current)
  useEffect(() => {
    const v = videoRef.current;
    if (!visible || !v) return;
    const cleanup = onAttachAnalytics?.(v);
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, videoRef, onAttachAnalytics]);

  // Try to start/resume when it becomes visible
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible) {
      v.muted = muted;
      // Don't block UI if autoplay fails; it's fine silently.
      v.play().catch(() => {});
    } else {
      try { v.pause(); } catch {}
    }
  }, [visible, muted, videoRef]);

  return (
    <div className="relative">
      {/* Optimized poster */}
      <img
        src={poster}
        alt={`Video thumbnail for post by ${post?.user_profiles?.display_name ?? 'User'}`}
        className="w-full max-h-80 object-cover rounded-lg absolute inset-0 z-10"
        loading="eager"
        fetchPriority="high"
        style={{ opacity: ready ? 0 : 1, transition: 'opacity 180ms ease-in' }}
      />

      <video
        ref={videoRef}
        className="w-full max-h-80 object-cover rounded-lg relative z-20"
        playsInline
        muted={muted}
        preload="metadata"
        poster={poster}
        aria-label={`Video in post by ${post?.user_profiles?.display_name ?? 'User'}`}
        controls={false}
        onLoadedData={() => setReady(true)}
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