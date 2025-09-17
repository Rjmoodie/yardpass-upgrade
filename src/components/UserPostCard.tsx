import { useState } from 'react';
import { Link } from 'react-router-dom';
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
}

export function UserPostCard({ item, onLike, onComment, onShare, onEventClick, onAuthorClick, onCreatePost, onReport }: UserPostCardProps) {
  const [mediaError, setMediaError] = useState(false);

  const mediaUrl = item.media_urls?.[0];
  const isVideo = isVideoUrl(mediaUrl);
  const videoSrc = isVideo ? buildMuxUrl(mediaUrl) : undefined;
  const { videoRef, ready } = useHlsVideo(videoSrc);
  const likes = item.metrics?.likes || 0;
  const comments = item.metrics?.comments || 0;

  // Log only when there's actual media
  if (mediaUrl) {
    console.log(`Post ${item.item_id}: ${isVideo ? 'Video' : 'Image'} - ${mediaUrl} ${videoSrc ? `-> ${videoSrc}` : ''} (ready: ${ready}, error: ${mediaError})`);
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return 'TBA';
    }
  };

  const getBadgeColor = (badge: string | null) => {
    switch (badge) {
      case 'ORGANIZER': return 'bg-orange-500';
      case 'VIP': return 'bg-purple-500';
      case 'EARLY': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="w-full h-screen relative overflow-hidden bg-black">
      {/* Background Media */}
      {mediaUrl && !mediaError ? (
        <div className="absolute inset-0">
          {isVideo ? (
            <>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                crossOrigin="anonymous"
                // Don't set src when using HLS.js - let useHlsVideo handle it
                // Let HLS.js handle all video events
              />
              {!ready && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </>
          ) : (
            <img
              src={mediaUrl}
              alt="Post media"
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                console.error('Image error:', e, 'src:', mediaUrl);
                setMediaError(true);
              }}
              onLoad={() => console.log('Image loaded:', mediaUrl)}
            />
          )}
        </div>
      ) : (
        <img
          src={item.event_cover_image || DEFAULT_EVENT_COVER}
          alt={item.event_title}
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
      )}
      
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
      />

      {/* BOTTOM META BAR */}
      <div className="absolute left-4 right-4 bottom-6 z-30">
        <div className="bg-black/80 backdrop-blur-md rounded-full px-4 py-3 flex items-center justify-between shadow-2xl border border-white/10">
          {/* Left side - Username */}
          <Link
            to={`/u/${item.author_id}`}
            className="text-white font-bold hover:underline text-base flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {item.author_name || 'User'}
          </Link>

          {/* VIP / ORGANIZER badge */}
          {item.author_badge && (
            <span className={`text-xs px-2 py-1 rounded-full text-white font-medium ml-2 flex-shrink-0 ${getBadgeColor(item.author_badge)}`}>
              {item.author_badge}
            </span>
          )}

          {/* Right side - Event */}
          <Link
            to={`/event/${item.event_id}`}
            className="text-white/90 hover:text-white font-medium text-base truncate ml-4"
            onClick={(e) => e.stopPropagation()}
          >
            {item.event_title || 'View event'}
          </Link>
        </div>

        {/* Post Content */}
        {item.content && (
          <p className="text-white text-sm leading-relaxed mt-2 bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2">
            {item.content}
          </p>
        )}
      </div>
    </div>
  );
}