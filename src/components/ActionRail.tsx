import React from 'react';
import { Heart, MessageCircle, Share2 } from 'lucide-react';

type Countable = number | undefined | null;

export interface ActionRailProps {
  className?: string;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  liked?: boolean;
  likeCount?: Countable;
  commentCount?: Countable;
  shareCount?: Countable;
  /** when true, prevents rail from intercepting vertical swipes */
  enablePointerEvents?: boolean;
}

export const ActionRail: React.FC<ActionRailProps> = ({
  className = '',
  onLike,
  onComment,
  onShare,
  liked,
  likeCount = 0,
  commentCount = 0,
  shareCount = 0,
  enablePointerEvents = true,
}) => {
  const pe = enablePointerEvents ? 'pointer-events-auto' : 'pointer-events-none';
  return (
    <div
      className={`absolute right-3 md:right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-5 z-20 ${pe} ${className}`}
    >
      <button
        aria-label="Like"
        onClick={(e) => { e.stopPropagation(); onLike?.(); }}
        className={`feed-rail-btn ${liked ? 'text-red-500' : ''}`}
      >
        <Heart className="w-7 h-7" />
        <span className="rail-count">{Number(likeCount || 0).toLocaleString()}</span>
      </button>

      <button
        aria-label="Comments"
        onClick={(e) => { e.stopPropagation(); onComment?.(); }}
        className="feed-rail-btn"
      >
        <MessageCircle className="w-7 h-7" />
        <span className="rail-count">{Number(commentCount || 0).toLocaleString()}</span>
      </button>

      <button
        aria-label="Share"
        onClick={(e) => { e.stopPropagation(); onShare?.(); }}
        className="feed-rail-btn"
      >
        <Share2 className="w-7 h-7" />
        <span className="rail-count">{Number(shareCount || 0).toLocaleString()}</span>
      </button>
    </div>
  );
};

export default ActionRail;