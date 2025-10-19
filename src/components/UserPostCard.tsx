// src/components/UserPostCard.tsx
import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { useHlsVideo } from '@/hooks/useHlsVideo';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { isVideoUrl, buildMuxUrl } from '@/utils/mux';
import { muxToPoster } from '@/utils/media';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { SocialLinkDisplay } from '@/components/SocialLinkDisplay';
import ActionRail from './ActionRail';
import ClampText from '@/components/ui/ClampText';
import PeekSheet from '@/components/overlays/PeekSheet';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';

interface UserPostCardProps {
  item: Extract<FeedItem, { item_type: 'post' }>;
  onLike: (postId: string, event?: React.MouseEvent) => void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
  onEventClick: (eventId: string, item?: FeedItem) => void;
  onAuthorClick?: (authorId: string) => void;
  onCreatePost?: () => void;
  onReport?: () => void;
  onSoundToggle?: () => void;
  onVideoToggle?: () => void;
  onOpenTickets?: (eventId: string, item?: FeedItem) => void;
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
  soundEnabled = false,
  isVideoPlaying = false,
}: UserPostCardProps) {
  const { trackEvent } = useAnalyticsIntegration();
  const [mediaError, setMediaError] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const mediaUrl = useMemo(() => item.media_urls?.[0] || null, [item.media_urls]);
  const isVideo = useMemo(() => Boolean(mediaUrl && isVideoUrl(mediaUrl!)), [mediaUrl]);
  const videoSrc = useMemo(() => {
    if (!isVideo || !mediaUrl) return undefined;
    return buildMuxUrl(mediaUrl);
  }, [isVideo, mediaUrl]);

  const likes = item.metrics?.likes ?? 0;
  const comments = item.metrics?.comments ?? 0;

  const { videoRef, ready, error: hlsError } = useHlsVideo(shouldLoadVideo ? videoSrc : undefined);

  // Lazy load video when component is about to be visible (more aggressive)
  useEffect(() => {
    if (!isVideo || shouldLoadVideo) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldLoadVideo(true); // ✅ same variable, just triggers earlier
            observer.disconnect();
            break;
          }
        }
      },
      {
        // start loading ~2 screen-heights before entry; tiny threshold so it fires early
        rootMargin: '200% 0px',
        threshold: 0.01,
      }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isVideo, shouldLoadVideo]);

  // Preconnect to Mux after idle for reduced handshake latency
  useEffect(() => {
    const add = (href: string) => {
      if (document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
      const l = document.createElement('link');
      l.rel = 'preconnect';
      l.href = href;
      document.head.appendChild(l);
    };
    // defer so we don't compete with critical paint
    const run = () => {
      add('https://stream.mux.com');
      add('https://image.mux.com');
    };
    if ('requestIdleCallback' in window) {
      // @ts-ignore
      const id = window.requestIdleCallback(run);
      return () => window.cancelIdleCallback?.(id as number);
    } else {
      const t = window.setTimeout(run, 1500);
      return () => window.clearTimeout(t);
    }
  }, []);

  // Play/pause side effect driven by isVideoPlaying
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isVideo) return;

    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!isVideoPlaying || hlsError || prefersReduced) {
      el.pause();
      return;
    }

    const readyStateLabels: Record<number, string> = {
      0: 'HAVE_NOTHING',
      1: 'HAVE_METADATA',
      2: 'HAVE_CURRENT_DATA',
      3: 'HAVE_FUTURE_DATA',
      4: 'HAVE_ENOUGH_DATA',
    };

    const attemptPlayback = () => {
      if (!el) return;
      el.currentTime = 0;
      const playPromise = el.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (import.meta.env?.DEV) {
              // eslint-disable-next-line no-console
              console.debug('✅ Video play successful', {
                postId: item.item_id,
                readyState: el.readyState,
                readyStateLabel: readyStateLabels[el.readyState] ?? 'UNKNOWN',
              });
            }
          })
          .catch((error) => {
            if (import.meta.env?.DEV) {
              // eslint-disable-next-line no-console
              console.warn('⚠️ Video play prevented', {
                postId: item.item_id,
                error,
                muted: el.muted,
                readyState: el.readyState,
                hlsReady: ready,
              });
            }
          });
      }
    };

    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      attemptPlayback();
      return;
    }

    const onCanPlay = () => {
      attemptPlayback();
      el.removeEventListener('canplay', onCanPlay);
    };

    el.addEventListener('canplay', onCanPlay);

    if (!ready) {
      const onLoadedData = () => {
        attemptPlayback();
        el.removeEventListener('loadeddata', onLoadedData);
      };

      el.addEventListener('loadeddata', onLoadedData);

      return () => {
        el.removeEventListener('canplay', onCanPlay);
        el.removeEventListener('loadeddata', onLoadedData);
      };
    }

    return () => {
      el.removeEventListener('canplay', onCanPlay);
    };
  }, [isVideoPlaying, ready, hlsError, isVideo, videoRef, item.item_id]);

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
    if (!el) return;

    if (!soundEnabled) {
      if (!el.hasAttribute('muted')) {
        el.setAttribute('muted', '');
      }
      el.muted = true;
    } else {
      el.muted = false;
      el.removeAttribute('muted');
    }
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
    onEventClick(item.event_id, item);
  }, [item.event_id, item, onEventClick]);

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
    <div ref={containerRef} className="relative h-full w-full flex-1 overflow-hidden bg-black">
      {/* Background Media */}
      {!showFallback ? (
        <div className="absolute inset-0">
          {isVideo ? (
            <div className="absolute inset-0">
              <video
                ref={videoRef}                             // ← same ref for useHlsVideo
                className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                muted                                      // ← you already sync with effect
                loop
                playsInline
                preload="metadata"                         // ✅ faster first-frame without heavy segments
                poster={muxToPoster(mediaUrl!)}            // ✅ cheap visual readiness
                crossOrigin="anonymous"
                onClick={handleVideoClick}
                aria-label={isVideoPlaying ? 'Pause video' : 'Play video'}
                disablePictureInPicture
                controlsList="nodownload nofullscreen noremoteplayback"
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

      {/* Post overlay */}
      <div className="absolute inset-0 flex flex-col justify-end pointer-events-none">
        <PeekSheet minHeight="200px" maxHeight="76vh">
          {/* Author + social */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={(e) => { e.stopPropagation(); onAuthorClick?.(item.author_id); }}
              className="text-white font-bold hover:underline text-base truncate"
              title={item.author_name || "User"}
            >
              {item.author_name || "User"}
            </button>

            {item.author_badge && (
              <span className={`text-xs px-2 py-1 rounded-lg text-white font-medium flex-shrink-0 ${badgeClass(item.author_badge as any)}`}>
                {item.author_badge}
              </span>
            )}

            {item.author_social_links && Array.isArray(item.author_social_links) && (
              <div className="ml-auto">
                <SocialLinkDisplay socialLinks={item.author_social_links} showPrimaryOnly className="text-white/80 hover:text-white" />
              </div>
            )}
          </div>

          {/* Event + tickets */}
          <div className="mt-2 grid grid-cols-[1fr,auto] items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); onEventClick(item.event_id); }}
              className="text-white/95 hover:text-white font-medium text-base text-left truncate"
              title={item.event_title || "View event"}
            >
              {item.event_title || "View event"}
            </button>

            {onOpenTickets && (
              <Button
            onClick={(e) => { e.stopPropagation(); onOpenTickets(item.event_id, item); }}
                className="h-10 px-4 rounded-2xl font-semibold"
              >
                🎟️ Tickets
              </Button>
            )}
          </div>

          {/* Caption with clamp */}
          {item.content && (
            <ClampText lines={4} className="mt-3 text-[15px] leading-relaxed">
              {item.content}
            </ClampText>
          )}
        </PeekSheet>
      </div>
    </div>
  );
});

export default UserPostCard;
