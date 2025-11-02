import { useState, useMemo, useCallback, memo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Share2, ChevronUp, ChevronDown, Calendar, MapPin, Eye } from 'lucide-react';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { isVideoUrl } from '@/utils/mux';
import { muxToPoster } from '@/lib/video/muxClient';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { VideoMedia } from '@/features/feed/components/VideoMedia';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';

interface UserPostCardModernProps {
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

export const UserPostCardModern = memo(function UserPostCardModern({
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
}: UserPostCardModernProps) {
  const [mediaError, setMediaError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const mediaUrl = useMemo(() => item.media_urls?.[0] || null, [item.media_urls]);
  const isVideo = useMemo(() => Boolean(mediaUrl && isVideoUrl(mediaUrl!)), [mediaUrl]);

  const likes = item.metrics?.likes ?? 0;
  const comments = item.metrics?.comments ?? 0;
  const views = item.metrics?.views ?? 0;
  const isLiked = item.metrics?.hasLiked ?? false;

  const formatDate = useCallback((dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(d);
    } catch {
      return '';
    }
  }, []);

  const handleLike = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onLike(item.item_id, e);
    },
    [item.item_id, onLike]
  );

  const handleComment = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onComment(item.item_id);
    },
    [item.item_id, onComment]
  );

  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onShare(item.item_id);
    },
    [item.item_id, onShare]
  );

  const handleAuthorClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onAuthorClick && item.author_id) {
        onAuthorClick(item.author_id);
      }
    },
    [item.author_id, onAuthorClick]
  );

  const handleEventClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (item.event_id) {
        onEventClick(item.event_id, item);
      }
    },
    [item, onEventClick]
  );

  // Determine media to show
  const posterImage = useMemo(() => {
    if (isVideo && mediaUrl) {
      return muxToPoster(mediaUrl);
    }
    return mediaUrl || item.event_cover_image || DEFAULT_EVENT_COVER;
  }, [isVideo, mediaUrl, item.event_cover_image]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {/* Background Media */}
      <div className="absolute inset-0">
        {isVideo && mediaUrl ? (
          <VideoMedia
            playbackId={mediaUrl}
            shouldAutoPlay={isVideoPlaying}
            muted={!soundEnabled}
            onTogglePlay={onVideoToggle}
            containerClassName="absolute inset-0"
            videoClassName="h-full w-full object-cover"
          />
        ) : (
          <ImageWithFallback
            src={posterImage}
            alt={item.content_text || 'Post media'}
            className="h-full w-full object-cover"
            onError={() => setMediaError(true)}
          />
        )}
        {/* Dark gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90" />
      </div>

      {/* Bottom info card - clickable to expand/collapse */}
      <div 
        className={`absolute left-3 right-3 z-30 transition-all duration-500 ease-out sm:left-4 sm:right-4 md:left-auto md:right-6 md:max-w-md lg:max-w-lg ${
          isExpanded 
            ? 'bottom-20 top-1/2 sm:bottom-24 md:bottom-28' 
            : 'bottom-20 sm:bottom-24 md:bottom-28'
        }`}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/20 bg-black/50 shadow-2xl backdrop-blur-2xl">
          {/* Clickable header section (div-as-button to avoid nested <button>) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsExpanded(!isExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsExpanded((v) => !v);
              }
            }}
            className="w-full p-5 text-left transition-all hover:bg-white/5 sm:p-6"
          >
            {/* Author and content */}
            <div className="mb-3 flex items-start justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                {/* Author Info */}
                <div 
                  className="mb-2 flex items-center gap-2 cursor-pointer"
                  onClick={handleAuthorClick}
                >
                  {item.author_photo && (
                    <img
                      src={item.author_photo}
                      alt={item.author_name || 'Author'}
                      className="h-8 w-8 rounded-full border border-white/20 object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-white">{item.author_name || 'Anonymous'}</p>
                    {item.created_at && (
                      <p className="text-xs text-white/60">{formatDate(item.created_at)}</p>
                    )}
                  </div>
                </div>

                {/* Post Content */}
                <p className={`text-sm text-white/90 transition-all duration-300 ${
                  isExpanded ? 'line-clamp-none' : 'line-clamp-3'
                }`}>
                  {item.content_text || 'No caption'}
                </p>

                {/* Social Actions Bar */}
                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={handleLike}
                    className="flex items-center gap-1.5 transition-all hover:scale-110 active:scale-95"
                  >
                    <Heart 
                      className={`h-5 w-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`}
                    />
                    <span className="text-xs font-semibold text-white">{likes}</span>
                  </button>

                  <button
                    onClick={handleComment}
                    className="flex items-center gap-1.5 transition-all hover:scale-110 active:scale-95"
                  >
                    <MessageCircle className="h-5 w-5 text-white" />
                    <span className="text-xs font-semibold text-white">{comments}</span>
                  </button>

                  <button
                    onClick={handleShare}
                    className="flex items-center gap-1.5 transition-all hover:scale-110 active:scale-95"
                  >
                    <Share2 className="h-5 w-5 text-white" />
                  </button>
                </div>

                {/* Views + explicit expand/collapse chevron (always visible) */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[13px] text-white/75">
                    <Eye className="h-4 w-4" />
                    <span className="font-semibold">{views}</span>
                    <span>views</span>
                  </div>

                  <button
                    type="button"
                    aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                    aria-expanded={isExpanded}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded((v) => !v);
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full
               border border-white/20 bg-white/10 hover:bg-white/20
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-white/80" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-white/80" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Expanded content - Event Details */}
          {isExpanded && item.event_id && (
            <div 
              className={`overflow-y-auto transition-all duration-500 ${
                isExpanded 
                  ? 'max-h-[600px] opacity-100' 
                  : 'max-h-0 opacity-0'
              }`}
            >
              <div className="border-t border-white/10 p-5 sm:p-6">
                <p className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">Posted in</p>

                {/* Event Title */}
                <h4 
                  className="mb-4 cursor-pointer text-base font-bold text-white hover:text-white/80 sm:text-lg"
                  onClick={handleEventClick}
                >
                  {item.event_title || 'Event'}
                </h4>

                {/* Event Date */}
                {item.event_start_at && (
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/60 sm:text-xs">Date & Time</p>
                      <p className="text-sm text-white/90 sm:text-base">{formatDate(item.event_start_at)}</p>
                    </div>
                  </div>
                )}

                {/* Event Location */}
                {item.event_venue && (
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/60 sm:text-xs">Location</p>
                      <p className="text-sm text-white/90 sm:text-base">{item.event_venue}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-5 flex gap-3">
                  <Button
                    onClick={handleEventClick}
                    variant="outline"
                    className="flex-1 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    View Event
                  </Button>
                  {onOpenTickets && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTickets(item.event_id!, item);
                      }}
                      className="flex-1 rounded-full bg-[#FF8C00] text-white hover:bg-[#FF9D1A]"
                    >
                      Get Tickets
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video playing indicator (optional) */}
      {isVideo && isVideoPlaying && (
        <div className="absolute bottom-4 left-4 z-40 rounded-full border border-white/30 bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-md">
          Playing
        </div>
      )}
    </div>
  );
});

