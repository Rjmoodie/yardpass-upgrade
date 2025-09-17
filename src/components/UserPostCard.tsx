import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause } from 'lucide-react';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { isVideoUrl, buildMuxUrl } from '@/utils/mux';
import { useHlsVideo } from '@/hooks/useHlsVideo';
import ActionRail from './ActionRail';
import type { FeedItem } from '@/hooks/useUnifiedFeed';

interface UserPostCardProps {
  item: Extract<FeedItem, { item_type: 'post' }>;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
  onEventClick: (eventId: string) => void;
  onAuthorClick?: (authorId: string) => void;
  onCreatePost?: () => void;
  onReport?: () => void;
  onSoundToggle?: () => void;
  onVideoToggle?: () => void;
  soundEnabled?: boolean;
  isVideoPlaying?: boolean;
}

type AuthorBadge = 'ORGANIZER' | 'VIP' | 'EARLY' | (string & {}) | null | undefined;

const BADGE_COLORS: Record<Exclude<AuthorBadge, null | undefined>, string> = {
  ORGANIZER: 'bg-orange-500',
  VIP: 'bg-purple-500',
  EARLY: 'bg-green-500',
};

function getBadgeColor(badge: AuthorBadge) {
  if (!badge) return 'bg-blue-500';
  return BADGE_COLORS[badge as keyof typeof BADGE_COLORS] ?? 'bg-blue-500';
}

export function UserPostCard({
  item,
  onLike,
  onComment,
  onShare,
  onEventClick,
  onAuthorClick,
  onCreatePost,
  onReport,
  onSoundToggle,
  onVideoToggle,
  soundEnabled = true,
  isVideoPlaying = false,
}: UserPostCardProps) {
  const [mediaError, setMediaError] = useState(false);

  // Derived values memoized for small perf wins
  const mediaUrl = useMemo(() => item.media_urls?.[0], [item.media_urls]);
  const isVideo = useMemo(() => Boolean(mediaUrl && isVideoUrl(mediaUrl)), [mediaUrl]);
  const videoSrc = useMemo(() => (isVideo && mediaUrl ? buildMuxUrl(mediaUrl) : undefined), [isVideo, mediaUrl]);
  const likes = item.metrics?.likes ?? 0;
  const comments = item.metrics?.comments ?? 0;

  const { videoRef, ready, error } = useHlsVideo(videoSrc);

  // Keep video element play/pause state in sync with prop
  useEffect(() => {
    const el = videoRef.current;
    if (!el) {
      console.log('UserPostCard: No video element found for:', item.item_id);
      return;
    }

    console.log('UserPostCard: Video element setup for:', item.item_id, {
      isVideoPlaying,
      ready,
      videoSrc,
      elementVisible: el.offsetWidth > 0 && el.offsetHeight > 0,
      hasSource: el.src || el.currentSrc,
      error
    });

    // Respect prefers-reduced-motion: reduce autoplay
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (isVideoPlaying && ready && !prefersReduced && !error) {
      // Ensure video is properly prepared for playback
      if (el.readyState >= 2) { // HAVE_CURRENT_DATA or higher
        el.currentTime = 0; // Start from beginning
        el.play().catch((err) => {
          console.log('UserPostCard: Video play failed for:', item.item_id, err);
          // Try again after a short delay
          setTimeout(() => {
            el.play().catch(console.warn);
          }, 100);
        });
      } else {
        // Wait for the video to be ready
        const onCanPlay = () => {
          el.currentTime = 0;
          el.play().catch(console.warn);
          el.removeEventListener('canplay', onCanPlay);
        };
        el.addEventListener('canplay', onCanPlay);
        
        // Cleanup listener if component unmounts
        return () => el.removeEventListener('canplay', onCanPlay);
      }
    } else {
      el.pause();
    }
  }, [isVideoPlaying, ready, videoRef, item.item_id, videoSrc, error]);

  // Update muted state when soundEnabled changes
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.muted = !soundEnabled;
    }
  }, [soundEnabled, videoRef]);

  // Wire minimal video error handling
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onError = () => setMediaError(true);
    el.addEventListener('error', onError);
    return () => el.removeEventListener('error', onError);
  }, [videoRef]);

  const handleRootClick = useCallback(() => {
    // Clicking the background navigates to the event
    onEventClick(item.event_id);
  }, [item.event_id, onEventClick]);

  const handleVideoClick: React.MouseEventHandler<HTMLVideoElement> = useCallback(
    (e) => {
      e.stopPropagation();
      onVideoToggle?.();
    },
    [onVideoToggle],
  );

  const handleImageError: React.ReactEventHandler<HTMLImageElement> = useCallback(
    (e) => {
      // Keep a concise log and fail over to event cover
      console.error('Image error src:', (e.target as HTMLImageElement)?.src);
      setMediaError(true);
    },
    [],
  );

  const handleAuthorClick: React.MouseEventHandler<HTMLAnchorElement> = useCallback(
    (e) => {
      e.stopPropagation();
      onAuthorClick?.(item.author_id);
    },
    [item.author_id, onAuthorClick],
  );

  const handleKeyDownRoot: React.KeyboardEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEventClick(item.event_id);
      }
    },
    [item.event_id, onEventClick],
  );

  const showFallback = !mediaUrl || mediaError || error;

  // Debug logging for video display
  useEffect(() => {
    if (isVideo && videoSrc) {
      console.log('UserPostCard: Video display debug for:', item.item_id, {
        mediaUrl,
        videoSrc,
        isVideo,
        showFallback,
        ready,
        mediaError,
        hlsError: error
      });
    }
  }, [isVideo, videoSrc, item.item_id, mediaUrl, showFallback, ready, mediaError, error]);

  return (
    <div
      className="w-full h-screen relative overflow-hidden bg-black"
      onClick={handleRootClick}
      onKeyDown={handleKeyDownRoot}
      role="button"
      tabIndex={0}
      aria-label={item.event_title || 'Open event'}
      title={item.event_title || 'Open event'}
    >
      {/* Background Media */}
      {!showFallback ? (
        <div className="absolute inset-0">
          {isVideo ? (
            <div className="absolute inset-0">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                // Enable better preloading for smoother experience
                autoPlay={false}
                muted={!soundEnabled}
                loop
                playsInline
                preload="auto" 
                crossOrigin="anonymous"
                onClick={handleVideoClick}
                aria-label={isVideoPlaying ? 'Pause video' : 'Play video'}
                // Add these attributes for better mobile support
                webkit-playsinline="true"
                x-webkit-airplay="allow"
                // Optimize video loading
                onLoadStart={() => console.log('Video load started for:', item.item_id)}
                onCanPlay={() => console.log('Video can play for:', item.item_id)}
                onError={(e) => console.error('Video error for:', item.item_id, e)}
              />
              
              {(!ready || error) && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  {error ? (
                    <div className="text-white text-center">
                      <div className="text-sm">Failed to load video</div>
                      <div className="text-xs opacity-70 mt-1">{error}</div>
                    </div>
                  ) : (
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="Loading video" />
                  )}
                </div>
              )}

              {/* Play/Pause Hover Overlay - only show when video is ready */}
              {ready && !error && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <div className="bg-black/60 rounded-full p-4">
                      {isVideoPlaying ? (
                        <Pause className="w-8 h-8 text-white" aria-hidden />
                      ) : (
                        <Play className="w-8 h-8 text-white" aria-hidden />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Play/Pause Hover Overlay */}
              {ready && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <div className="bg-black/60 rounded-full p-4">
                      {isVideoPlaying ? (
                        <Pause className="w-8 h-8 text-white" aria-hidden />
                      ) : (
                        <Play className="w-8 h-8 text-white" aria-hidden />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <img
              src={mediaUrl!}
              alt={item.event_title ? `Media for ${item.event_title}` : 'Post media'}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={handleImageError}
            />
          )}
        </div>
      ) : (
        <img
          src={item.event_cover_image || DEFAULT_EVENT_COVER}
          alt={item.event_title ? `Cover for ${item.event_title}` : 'Event cover'}
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Subtle gradient for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

      {/* RIGHT ACTION RAIL (TikTok style) */}
      <ActionRail
        liked={item.metrics?.viewer_has_liked || false}
        likeCount={likes}
        commentCount={comments}
        onLike={() => onLike(item.item_id)}
        onComment={() => onComment(item.item_id)}
        onShare={() => onShare(item.item_id)}
        onCreatePost={onCreatePost}
        onReport={onReport}
        onSoundToggle={onSoundToggle}
        soundEnabled={soundEnabled}
      />

      {/* BOTTOM META BAR */}
      <div className="absolute left-4 right-4 bottom-6 z-30 pointer-events-none">
        <div className="bg-black/80 backdrop-blur-md rounded-full px-4 py-3 flex items-center justify-between shadow-2xl border border-white/10 pointer-events-auto">
          {/* Left - Username */}
          <Link
            to={`/u/${item.author_id}`}
            className="text-white font-bold hover:underline text-base flex-shrink-0"
            onClick={handleAuthorClick}
            title={item.author_name || 'User'}
          >
            {item.author_name || 'User'}
          </Link>

          {/* VIP / ORGANIZER badge */}
          {item.author_badge && (
            <span
              className={`text-xs px-2 py-1 rounded-full text-white font-medium ml-2 flex-shrink-0 ${getBadgeColor(item.author_badge as AuthorBadge)}`}
              aria-label={String(item.author_badge)}
              title={String(item.author_badge)}
            >
              {item.author_badge}
            </span>
          )}

          {/* Right - Event link */}
          <Link
            to={`/event/${item.event_id}`}
            className="text-white/90 hover:text-white font-medium text-base truncate ml-4"
            onClick={(e) => e.stopPropagation()}
            title={item.event_title || 'View event'}
          >
            {item.event_title || 'View event'}
          </Link>
        </div>

        {/* Post Content */}
        {item.content && (
          <p className="text-white text-sm leading-relaxed mt-2 bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2 pointer-events-auto">
            {item.content}
          </p>
        )}
      </div>
    </div>
  );
}
