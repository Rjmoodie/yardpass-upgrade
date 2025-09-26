import React from 'react';
import { Heart, MessageCircle, Share2, Plus, Flag, Volume2, VolumeX } from 'lucide-react';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';

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
  const pe = enablePointerEvents ? 'pointer-events-auto' : 'pointer-events-none';
  return (
    <div
      className={`absolute right-3 md:right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 z-20 ${pe} ${className}`}
    >
      {!hideEngagement && (
        <>
          <button
            aria-label="Like"
            onClick={(e) => { 
              e.stopPropagation(); 
              onLike?.(e);
              trackEvent('engagement_like', {
                content_type: 'post',
                content_id: postId,
                event_id: eventId,
                liked: !liked
              });
            }}
            className={`feed-rail-btn ${liked ? 'text-red-500' : ''}`}
          >
            <Heart className="w-7 h-7" />
            <span className="rail-count">{Number(likeCount || 0).toLocaleString()}</span>
          </button>

          <button
            aria-label="Comments"
            onClick={(e) => { 
              e.stopPropagation(); 
              onComment?.();
              trackEvent('engagement_comment', {
                content_type: 'post',
                content_id: postId,
                event_id: eventId
              });
            }}
            className="feed-rail-btn"
          >
            <MessageCircle className="w-7 h-7" />
            <span className="rail-count">{Number(commentCount || 0).toLocaleString()}</span>
          </button>

          <button
            aria-label="Share"
            onClick={(e) => { 
              e.stopPropagation(); 
              onShare?.();
              trackEvent('engagement_share', {
                content_type: 'post',
                content_id: postId,
                event_id: eventId
              });
            }}
            className="feed-rail-btn"
          >
            <Share2 className="w-7 h-7" />
            <span className="rail-count">{Number(shareCount || 0).toLocaleString()}</span>
          </button>
        </>
      )}

      <button
        aria-label="Create post"
        onClick={(e) => { 
          e.stopPropagation(); 
          onCreatePost?.();
          trackEvent('engagement_create_post_cta', {
            event_id: eventId,
            source: 'action_rail'
          });
        }}
        className="p-3 rounded-full bg-primary/90 backdrop-blur-sm border border-primary/60 hover:bg-primary transition-all duration-200 shadow-lg min-h-[48px] min-w-[48px] touch-manipulation"
      >
        <Plus className="w-5 h-5 text-white" />
      </button>

      <button
        aria-label="Report"
        onClick={(e) => { e.stopPropagation(); onReport?.(); }}
        className="feed-rail-btn"
      >
        <Flag className="w-6 h-6" />
      </button>

      <button
        aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
        onClick={(e) => { e.stopPropagation(); onSoundToggle?.(); }}
        className="feed-rail-btn"
      >
        {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
      </button>
    </div>
  );
};

export default ActionRail;