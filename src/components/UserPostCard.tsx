import { useState } from 'react';
import { Heart, MessageCircle, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { isVideoUrl, buildMuxUrl } from '@/utils/mux';
import { useHlsVideo } from '@/hooks/useHlsVideo';
import type { FeedItem } from '@/hooks/useUnifiedFeed';

interface UserPostCardProps {
  item: Extract<FeedItem, { item_type: 'post' }>;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
  onEventClick: (eventId: string) => void;
}

export function UserPostCard({ item, onLike, onComment, onShare, onEventClick }: UserPostCardProps) {
  const [mediaError, setMediaError] = useState(false);

  const mediaUrl = item.media_urls?.[0];
  const isVideo = isVideoUrl(mediaUrl);
  const videoSrc = isVideo ? buildMuxUrl(mediaUrl) : undefined;
  const { videoRef, ready } = useHlsVideo(videoSrc);
  const likes = item.metrics?.likes || 0;
  const comments = item.metrics?.comments || 0;

  // Log media information for debugging
  console.log('UserPostCard media:', {
    postId: item.item_id,
    hasMediaUrls: !!item.media_urls?.length,
    mediaUrl,
    isVideo,
    videoSrc,
    ready,
    mediaError
  });

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
                onError={(e) => {
                  console.error('Video error:', e, 'src:', videoSrc);
                  setMediaError(true);
                }}
                onLoadStart={() => console.log('Video loading:', videoSrc)}
                onCanPlay={() => console.log('Video can play:', videoSrc)}
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

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-6">
        {/* Top: Event Context */}
        <div className="flex items-center justify-between">
          <Button
            onClick={() => onEventClick(item.event_id)}
            variant="ghost"
            className="bg-black/40 backdrop-blur-sm border border-white/20 text-white hover:bg-black/60 px-3 py-2 text-sm"
          >
            <span className="truncate max-w-[200px]">{item.event_title}</span>
            <span className="text-white/60 ml-2">• {formatDate(item.event_starts_at)}</span>
          </Button>
        </div>

        {/* Bottom: Post Content & Actions */}
        <div className="space-y-4">
          {/* Author Info */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">
                {item.author_name || 'Anonymous'}
              </span>
              {item.author_badge && (
                <span className={`text-xs px-2 py-1 rounded-full text-white font-medium ${getBadgeColor(item.author_badge)}`}>
                  {item.author_badge}
                </span>
              )}
            </div>
          </div>

          {/* Post Content */}
          {item.content && (
            <p className="text-white text-lg leading-relaxed">
              {item.content}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-6">
            <button
              onClick={() => onLike(item.item_id)}
              className="flex items-center gap-2 text-white hover:text-red-400 transition-colors"
            >
              <Heart className="w-6 h-6" />
              {likes > 0 && <span className="text-sm font-medium">{likes}</span>}
            </button>

            <button
              onClick={() => onComment(item.item_id)}
              className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors"
            >
              <MessageCircle className="w-6 h-6" />
              {comments > 0 && <span className="text-sm font-medium">{comments}</span>}
            </button>

            <button
              onClick={() => onShare(item.item_id)}
              className="flex items-center gap-2 text-white hover:text-green-400 transition-colors"
            >
              <Share className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}