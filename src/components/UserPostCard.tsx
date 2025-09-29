// src/components/UserPostCard.tsx
import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Ticket } from 'lucide-react';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { isVideoUrl, buildMuxUrl } from '@/utils/mux';
import { muxToPoster } from '@/utils/media';
import { useHlsVideo } from '@/hooks/useHlsVideo';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { SocialLinkDisplay } from '@/components/SocialLinkDisplay';
import ActionRail from './ActionRail';
import type { FeedItem } from '@/hooks/useUnifiedFeed';

interface UserPostCardProps {
  item: Extract<FeedItem, { item_type: 'post' }>;
  onLike: (postId: string, event?: React.MouseEvent) => void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
  onEventClick: (eventId: string) => void;
  onAuthorClick?: (authorId: string) => void;
  onCreatePost?: () => void;
  onReport?: () => void;
  onSoundToggle?: () => void;
  onVideoToggle?: () => void;
  onOpenTickets?: (eventId: string) => void;
  soundEnabled?: boolean;
  isVideoPlaying?: boolean;
}

type AuthorBadge = 'ORGANIZER' | 'VIP' | 'EARLY' | (string & {}) | null | undefined;

const BADGE_COLORS: Record<'ORGANIZER' | 'VIP' | 'EARLY', string> = {
  ORGANIZER: 'bg-orange-500',
  VIP: 'bg-purple-500',
  EARLY: 'bg-green-500',
};

function badgeClass(badge: AuthorBadge) {
  if (!badge) return 'bg-blue-500';
  return BADGE_COLORS[(badge as keyof typeof BADGE_COLORS)] ?? 'bg-blue-500';
}

export const UserPostCard = memo(function UserPostCard({
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
  onOpenTickets,
  soundEnabled = true,
  isVideoPlaying = false,
}: UserPostCardProps) {
  const { trackEvent } = useAnalyticsIntegration();
  const [mediaError, setMediaError] = useState(false);

  const mediaUrl = useMemo(() => {
    const url = item.media_urls?.[0] || null;
    console.log('🖼️ UserPostCard media debug:', { 
      postId: item.item_id, 
      media_urls: item.media_urls, 
      selectedUrl: url 
    });
    return url;
  }, [item.media_urls, item.item_id]);
  const isVideo = useMemo(() => Boolean(mediaUrl && isVideoUrl(mediaUrl!)), [mediaUrl]);
  const videoSrc = useMemo(() => (isVideo && mediaUrl ? buildMuxUrl(mediaUrl) : undefined), [isVideo, mediaUrl]);

  const likes = item.metrics?.likes ?? 0;
  const comments = item.metrics?.comments ?? 0;

  const { videoRef, ready, error: hlsError } = useHlsVideo(videoSrc);

  // Play/pause side effect driven by isVideoPlaying
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isVideo) return;

    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (isVideoPlaying && ready && !prefersReduced && !hlsError) {
      if (el.readyState >= 2) {
        // reset to start for consistent short-loop promo style
        el.currentTime = 0;
        el.play().catch(() => {/* noop: autoplay policy fallback */});
      } else {
        const onCanPlay = () => {
          el.currentTime = 0;
          el.play().catch(() => {/* noop */});
          el.removeEventListener('canplay', onCanPlay);
        };
        el.addEventListener('canplay', onCanPlay);
        return () => el.removeEventListener('canplay', onCanPlay);
      }
    } else {
      el.pause();
    }
  }, [isVideoPlaying, ready, hlsError, isVideo, videoRef]);

  // Track video milestones and basic interactions
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;

    const video = videoRef.current;
    let viewStart = 0;
    let lastMilestone = 0; // 0, 25, 50, 75

    const onTimeUpdate = () => {
      const { currentTime, duration } = video;
      if (!duration || duration <= 0) return;
      const pct = (currentTime / duration) * 100;

      if (pct >= 25 && lastMilestone < 25) {
        trackEvent('video_progress_25', { post_id: item.item_id, event_id: item.event_id, duration, current_time: currentTime });
        lastMilestone = 25;
      } else if (pct >= 50 && lastMilestone < 50) {
        trackEvent('video_progress_50', { post_id: item.item_id, event_id: item.event_id, duration, current_time: currentTime });
        lastMilestone = 50;
      } else if (pct >= 75 && lastMilestone < 75) {
        trackEvent('video_progress_75', { post_id: item.item_id, event_id: item.event_id, duration, current_time: currentTime });
        lastMilestone = 75;
      } else if (pct >= 95) {
        trackEvent('video_complete', {
          post_id: item.item_id,
          event_id: item.event_id,
          duration,
          current_time: currentTime,
          view_duration: viewStart ? Date.now() - viewStart : undefined,
        });
      }
    };

    const onPlay = () => {
      viewStart = Date.now();
      trackEvent('video_play', { post_id: item.item_id, event_id: item.event_id, current_time: video.currentTime });
    };
    const onPause = () => {
      trackEvent('video_pause', {
        post_id: item.item_id,
        event_id: item.event_id,
        current_time: video.currentTime,
        view_duration: viewStart ? Date.now() - viewStart : undefined,
      });
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [isVideo, videoRef, item.item_id, item.event_id, trackEvent]);

  // Keep mute state in sync
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.muted = !soundEnabled;
  }, [soundEnabled, videoRef]);

  // Media error handlers
  const handleImageError = useCallback<React.ReactEventHandler<HTMLImageElement>>(() => {
    setMediaError(true);
  }, []);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onError = () => setMediaError(true);
    el.addEventListener('error', onError);
    return () => el.removeEventListener('error', onError);
  }, [videoRef]);

  // Handlers
  const handleRootClick = useCallback(() => {
    onEventClick(item.event_id);
  }, [item.event_id, onEventClick]);

  const handleVideoClick = useCallback<React.MouseEventHandler<HTMLVideoElement>>(
    (e) => {
      e.stopPropagation();
      onVideoToggle?.();
    },
    [onVideoToggle]
  );

  const handleAuthorClickWrapper = useCallback<React.MouseEventHandler<HTMLAnchorElement>>(
    (e) => {
      e.stopPropagation();
      onAuthorClick?.(item.author_id);
    },
    [onAuthorClick, item.author_id]
  );

  const handleKeyDownRoot = useCallback<React.KeyboardEventHandler<HTMLDivElement>>(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEventClick(item.event_id);
      }
    },
    [item.event_id, onEventClick]
  );

  // Fallback if no media or error
  const showFallback = !mediaUrl || mediaError || !!hlsError;

  // Dev-only diagnostics
  if (import.meta.env?.DEV && isVideo && videoSrc) {
    // eslint-disable-next-line no-console
    console.debug('UserPostCard video debug', {
      post: item.item_id,
      isVideoPlaying,
      ready,
      videoSrc,
      hlsError,
      showFallback,
    });
  }

  return (
    <div
      className="w-full h-screen relative overflow-hidden bg-black"
    >
      {/* Background Media */}
      {!showFallback ? (
        <div className="absolute inset-0">
          {isVideo ? (
            <div className="absolute inset-0">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                // Controlled externally; we don't use autoPlay to respect autoplay policies
                muted={!soundEnabled}
                loop
                playsInline
                preload="auto"
                crossOrigin="anonymous"
                onClick={handleVideoClick}
                aria-label={isVideoPlaying ? 'Pause video' : 'Play video'}
              />
              {/* Loading / error mask */}
              {(!ready || hlsError) && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  {hlsError ? (
                    <div className="text-white text-sm">Failed to load video</div>
                  ) : (
                    <div
                      className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
                      aria-label="Loading video"
                    />
                  )}
                </div>
              )}

              {/* Hover play/pause hint (desktop) */}
              {ready && !hlsError && (
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
              src={muxToPoster(mediaUrl!)}
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

      {/* Enhanced mobile legibility gradient with stronger contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/30" />
      
      {/* Additional text readability overlay */}
      <div className="absolute inset-0" style={{
        background: `linear-gradient(
          to top,
          rgba(0,0,0,0.9) 0%,
          rgba(0,0,0,0.6) 30%,
          rgba(0,0,0,0.2) 60%,
          rgba(0,0,0,0.5) 85%,
          rgba(0,0,0,0.3) 100%
        )`
      }} />

      {/* Action rail */}
      <ActionRail
        postId={item.item_id}
        eventId={item.event_id}
        liked={item.metrics?.viewer_has_liked || false}
        likeCount={likes}
        commentCount={comments}
        onLike={(event) => onLike(item.item_id, event)}
        onComment={() => onComment(item.item_id)}
        onShare={() => onShare(item.item_id)}
        onCreatePost={onCreatePost}
        onReport={onReport}
        onSoundToggle={onSoundToggle}
        soundEnabled={soundEnabled}
      />

      {/* Bottom meta bar - Enhanced mobile contrast */}
      <div className="absolute left-4 right-20 bottom-safe-bottom pb-6 z-30 pointer-events-none">
        <div className="bg-black/90 backdrop-blur-xl rounded-2xl px-4 py-3 flex flex-col gap-3 shadow-xl border border-white/30 pointer-events-auto max-w-full overflow-hidden"
             style={{ backdropFilter: 'blur(20px) saturate(180%)' }}>
          {/* Author and event info */}
          <div className="flex items-center gap-2 min-w-0 w-full">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAuthorClick?.(item.author_id);
              }}
              className="text-white font-bold hover:underline text-base flex-shrink-0 bg-transparent border-none cursor-pointer min-h-[44px] px-0 flex items-center"
              style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}
              title={item.author_name || 'User'}
            >
              {item.author_name || 'User'}
            </button>

            {item.author_badge && (
              <span
                className={`text-xs px-2 py-1 rounded-lg text-white font-medium flex-shrink-0 ${badgeClass(
                  item.author_badge as AuthorBadge
                )}`}
                aria-label={String(item.author_badge)}
                title={String(item.author_badge)}
              >
                {item.author_badge}
              </span>
            )}

            {item.author_social_links && Array.isArray(item.author_social_links) && (
              <div className="flex items-center ml-auto">
                <SocialLinkDisplay
                  socialLinks={item.author_social_links}
                  showPrimaryOnly
                  className="text-white/80 hover:text-white"
                />
              </div>
            )}
          </div>

          {/* Event title and ticket button */}
          <div className="flex items-center justify-between gap-3 min-w-0 w-full">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(item.event_id);
              }}
              className="text-white/95 hover:text-white font-medium text-base truncate bg-transparent border-none cursor-pointer text-left min-h-[44px] px-0 flex items-center flex-1"
              style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}
              title={item.event_title || 'View event'}
            >
              {item.event_title || 'View event'}
            </button>
            
            {onOpenTickets && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTickets(item.event_id);
                }}
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 px-6 py-3 rounded-2xl text-base font-semibold transition-all duration-200 shadow-lg min-h-[44px] min-w-[120px] touch-manipulation"
                title="Get tickets"
              >
                <Ticket size={18} />
                <span>Tickets</span>
              </button>
            )}
          </div>
        </div>

        {/* Post content */}
        {item.content && (
          <div className="mt-3 pointer-events-auto">
            <p className="text-white text-base leading-relaxed bg-black/60 backdrop-blur-sm rounded-xl px-4 py-3 line-clamp-4 font-medium"
               style={{ 
                 textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                 backdropFilter: 'blur(12px) saturate(120%)'
               }}>
              {item.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

export default UserPostCard;
