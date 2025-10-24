import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Bookmark, Play, Pause } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
}

export function VideoPlayer({ src, poster }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const progress = (video.currentTime / video.duration) * 100;
      setProgress(progress);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-black" style={{ aspectRatio: "9/16", maxHeight: "80vh" }}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="h-full w-full object-cover"
        loop
        playsInline
        muted={isMuted}
        onClick={togglePlay}
      />

      {/* Play/Pause overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <button
            onClick={togglePlay}
            className="rounded-full bg-black/50 p-6 backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
          >
            <Play className="h-12 w-12 fill-white text-white" />
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
        <div
          className="h-full bg-white transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Sound toggle */}
      <button
        onClick={toggleMute}
        className="absolute bottom-4 right-4 rounded-full bg-black/50 p-3 backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
      >
        {isMuted ? (
          <VolumeX className="h-5 w-5 text-white" />
        ) : (
          <Volume2 className="h-5 w-5 text-white" />
        )}
      </button>

      {/* Bookmark button */}
      <button
        onClick={toggleBookmark}
        className="absolute right-4 top-4 rounded-full bg-black/50 p-3 backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
      >
        <Bookmark
          className={`h-5 w-5 ${
            isBookmarked ? "fill-[#FF8C00] text-[#FF8C00]" : "text-white"
          }`}
        />
      </button>
    </div>
  );
}
