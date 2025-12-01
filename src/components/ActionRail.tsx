import React from 'react';
import { Heart, MessageCircle, Share2, Plus, Flag, Volume2, VolumeX } from 'lucide-react';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useHaptics } from '@/hooks/useHaptics';

type Countable = number | undefined | null;

export interface ActionRailProps {
  className?: string;
  postId?: string;
  eventId?: string;
  onLike?: (event?: React.MouseEvent) => void;
  onComment?: () => void;
  onShare?: () => void;
  onCreatePost?: () => void;
  onReport?: () => void;
  onSoundToggle?: () => void;
  liked?: boolean;
  likeCount?: Countable;
  commentCount?: Countable;
  shareCount?: Countable;
  soundEnabled?: boolean;
  /** when true, prevents rail from intercepting vertical swipes */
  enablePointerEvents?: boolean;
  /** when true, hides like/comment/share buttons (for events) */
  hideEngagement?: boolean;
}

export const ActionRail: React.FC<ActionRailProps> = ({
  className = '',
  postId,
  eventId,
  onLike,
  onComment,
  onShare,
  onCreatePost,
  onReport,
  onSoundToggle,
  liked,
  likeCount = 0,
  commentCount = 0,
  shareCount = 0,
  soundEnabled = true,
  enablePointerEvents = true,
  hideEngagement = false,
}) => {
  const { trackEvent } = useAnalyticsIntegration();
  const { impactLight, impactMedium } = useHaptics();
  const pe = enablePointerEvents ? 'pointer-events-auto' : 'pointer-events-none';
  return (
    <div
      className={`absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-20 ${pe} ${className}`}
    >
      {!hideEngagement && (
        <>
          <button
            aria-label={liked ? "Unlike post" : "Like post"}
            disabled={false}
            onClick={async (e) => { 
              e.preventDefault();
              e.stopPropagation();
              await impactLight();
              onLike?.(e);
              trackEvent('engagement_like', {
                content_type: 'post',
                content_id: postId,
                event_id: eventId,
                liked: !liked
              });
            }}
            className={`feed-rail-btn transition-transform active:scale-90 ${
              liked ? 'text-red-500 bg-red-500/20 border-red-500/40' : 'text-white'
            }`}
          >
            <Heart 
              className={`w-6 h-6 transition-all duration-200 ${liked ? 'fill-current scale-110' : ''}`}
              style={{
                imageRendering: '-webkit-optimize-contrast',
                WebkitFontSmoothing: 'antialiased',
              }}
            />
            <span className="rail-count">{Number(likeCount || 0).toLocaleString()}</span>
          </button>

          <button
            aria-label="View comments"
            onClick={async (e) => { 
              e.stopPropagation();
              await impactLight();
              onComment?.();
              trackEvent('engagement_comment', {
                content_type: 'post',
                content_id: postId,
                event_id: eventId
              });
            }}
            className="feed-rail-btn transition-transform active:scale-90"
          >
            <MessageCircle 
              className="w-6 h-6"
              style={{
                imageRendering: '-webkit-optimize-contrast',
                WebkitFontSmoothing: 'antialiased',
              }}
            />
            <span className="rail-count">{Number(commentCount || 0).toLocaleString()}</span>
          </button>

          <button
            aria-label="Share post"
            onClick={async (e) => { 
              e.stopPropagation();
              await impactLight();
              onShare?.();
              trackEvent('engagement_share', {
                content_type: 'post',
                content_id: postId,
                event_id: eventId
              });
            }}
            className="feed-rail-btn transition-transform active:scale-90"
          >
            <Share2 
              className="w-6 h-6"
              style={{
                imageRendering: '-webkit-optimize-contrast',
                WebkitFontSmoothing: 'antialiased',
              }}
            />
            <span className="rail-count">{Number(shareCount || 0).toLocaleString()}</span>
          </button>
        </>
      )}

      <button
        aria-label="Create post"
        onClick={async (e) => { 
          e.stopPropagation();
          await impactMedium();
          onCreatePost?.();
          trackEvent('engagement_create_post_cta', {
            event_id: eventId,
            source: 'action_rail'
          });
        }}
        className="flex items-center justify-center rounded-full bg-primary backdrop-blur-sm backdrop-blur-fallback border border-primary/60 hover:bg-primary/90 transition-all duration-200 shadow-lg min-h-[52px] min-w-[52px] touch-manipulation active:scale-90"
        style={{
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
        }}
      >
        <Plus 
          className="w-6 h-6 text-white"
          style={{
            imageRendering: '-webkit-optimize-contrast',
            WebkitFontSmoothing: 'antialiased',
          }}
        />
      </button>

      <button
        aria-label="Report content"
        onClick={async (e) => { 
          e.stopPropagation();
          await impactLight();
          onReport?.();
        }}
        className="feed-rail-btn transition-transform active:scale-90"
      >
        <Flag 
          className="w-5 h-5"
          style={{
            imageRendering: '-webkit-optimize-contrast',
            WebkitFontSmoothing: 'antialiased',
          }}
        />
      </button>

      <button
        aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
        onClick={async (e) => { 
          e.stopPropagation();
          await impactLight();
          onSoundToggle?.();
        }}
        className="feed-rail-btn transition-transform active:scale-90"
      >
        {soundEnabled ? (
          <Volume2 
            className="w-5 h-5"
            style={{
              imageRendering: '-webkit-optimize-contrast',
              WebkitFontSmoothing: 'antialiased',
            }}
          />
        ) : (
          <VolumeX 
            className="w-5 h-5"
            style={{
              imageRendering: '-webkit-optimize-contrast',
              WebkitFontSmoothing: 'antialiased',
            }}
          />
        )}
      </button>
    </div>
  );
};

export default ActionRail;