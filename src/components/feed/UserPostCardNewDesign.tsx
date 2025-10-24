import React, { useState, useMemo } from "react";
import { Heart, MessageCircle, Share2, MoreVertical } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { VideoMedia } from "@/components/feed/VideoMedia";
import type { FeedItem } from "@/hooks/unifiedFeedTypes";
import { isVideoUrl } from "@/utils/mux";

interface UserPostCardNewDesignProps {
  item: Extract<FeedItem, { item_type: 'post' }>;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onAuthorClick: () => void;
  soundEnabled?: boolean;
  isVideoPlaying?: boolean;
}

export function UserPostCardNewDesign({
  item,
  onLike,
  onComment,
  onShare,
  onAuthorClick,
  soundEnabled = false,
  isVideoPlaying = false
}: UserPostCardNewDesignProps) {
  const [liked, setLiked] = useState(item.metrics?.hasLiked || false);
  const [likeCount, setLikeCount] = useState(item.metrics?.likes || 0);
  const [showFullCaption, setShowFullCaption] = useState(false);

  const mediaUrl = useMemo(() => item.media_urls?.[0] || null, [item.media_urls]);
  const isVideo = useMemo(() => Boolean(mediaUrl && isVideoUrl(mediaUrl!)), [mediaUrl]);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    onLike();
  };

  const truncatedCaption = (item.content_text || '').length > 120 
    ? (item.content_text || '').slice(0, 120) + "..." 
    : (item.content_text || '');

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[32px] border border-white/[0.12] bg-white/[0.05] shadow-[0_40px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      {/* Inner glow */}
      <div className="absolute inset-0 -z-10 opacity-70" style={{
        background: 'radial-gradient(circle at top, rgba(255,255,255,0.16) 0%, transparent 55%)'
      }} />

      <div className="flex h-full flex-col">
        {/* Post Header */}
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <button onClick={onAuthorClick} className="h-10 w-10 overflow-hidden rounded-full border-2 border-white/20">
            <ImageWithFallback
              src={item.author_photo || ''}
              alt={item.author_name || 'User'}
              className="h-full w-full object-cover"
            />
          </button>

          <div className="flex-1">
            <button onClick={onAuthorClick} className="text-left">
              <div className="text-sm font-semibold text-white">{item.author_name || 'User'}</div>
              <div className="text-xs text-white/60">
                {item.event_title && `${item.event_title} • `}
                {item.created_at && new Date(item.created_at).toLocaleDateString()}
              </div>
            </button>
          </div>

          <button className="rounded-full p-2 transition-colors hover:bg-white/10">
            <MoreVertical className="h-5 w-5 text-white/70" />
          </button>
        </div>

        {/* Media Area */}
        <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
          {isVideo && mediaUrl ? (
            <div className="w-full rounded-xl overflow-hidden" style={{ maxHeight: "60vh" }}>
              <VideoMedia
                url={mediaUrl}
                post={{
                  id: item.item_id,
                  event_id: item.event_id,
                  author_user_id: item.author_id,
                  user_profiles: { display_name: item.author_name },
                  text: item.content_text
                }}
                visible={isVideoPlaying}
              />
            </div>
          ) : mediaUrl ? (
            <div className="relative w-full overflow-hidden rounded-xl" style={{ maxHeight: "60vh" }}>
              <ImageWithFallback
                src={mediaUrl}
                alt="Post media"
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        {/* Caption */}
        {item.content_text && (
          <div className="px-4 py-3">
            <p className="text-sm text-white/90">
              {showFullCaption ? item.content_text : truncatedCaption}
              {item.content_text.length > 120 && (
                <button
                  onClick={() => setShowFullCaption(!showFullCaption)}
                  className="ml-2 text-sm font-medium text-white/60 hover:text-white"
                >
                  {showFullCaption ? "less" : "more"}
                </button>
              )}
            </p>
          </div>
        )}

        {/* Action Rail */}
        <div className="flex items-center justify-around border-t border-white/10 p-4">
          <button
            onClick={handleLike}
            className="flex min-w-[44px] items-center justify-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 hover:bg-white/10 active:scale-95"
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                liked ? "fill-red-600 text-red-600" : "text-white"
              }`}
            />
            <span className="text-sm font-medium text-white/80">{likeCount}</span>
          </button>

          <button 
            onClick={onComment}
            className="flex min-w-[44px] items-center justify-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 hover:bg-white/10 active:scale-95"
          >
            <MessageCircle className="h-5 w-5 text-white" />
            <span className="text-sm font-medium text-white/80">{item.metrics?.comments || 0}</span>
          </button>

          <button 
            onClick={onShare}
            className="flex min-w-[44px] items-center justify-center gap-2 rounded-full px-4 py-2 transition-all hover:scale-105 hover:bg-white/10 active:scale-95"
          >
            <Share2 className="h-5 w-5 text-white" />
            <span className="text-sm font-medium text-white/80">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
}

