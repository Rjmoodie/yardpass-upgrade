import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MoreVertical, Flag, UserX, Bookmark, ChevronUp, MapPin, Calendar, Ticket } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { VideoMedia } from "@/components/feed/VideoMedia";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import type { FeedItem } from "@/hooks/unifiedFeedTypes";
import { isVideoUrl } from "@/utils/mux";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserPostCardNewDesignProps {
  item: Extract<FeedItem, { item_type: 'post' }>;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onAuthorClick: () => void;
  onReport?: () => void;
  soundEnabled?: boolean;
  isVideoPlaying?: boolean;
  onGetTickets?: (eventId: string) => void;
}

export function UserPostCardNewDesign({
  item,
  onLike,
  onComment,
  onShare,
  onAuthorClick,
  onReport,
  soundEnabled = false,
  isVideoPlaying = false,
  onGetTickets
}: UserPostCardNewDesignProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(item.metrics?.hasLiked || false);
  const [likeCount, setLikeCount] = useState(item.metrics?.likes || 0);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isOwnPost = user?.id === item.author_id;

  const mediaUrl = useMemo(() => item.media_urls?.[0] || null, [item.media_urls]);
  const isVideo = useMemo(() => Boolean(mediaUrl && isVideoUrl(mediaUrl!)), [mediaUrl]);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    onLike();
  };

  const truncatedCaption = (item.content || '').length > 120 
    ? (item.content || '').slice(0, 120) + "..." 
    : (item.content || '');

  const formatEventDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'TBA';
    }
  };

  const formatEventTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Full Screen Media Background */}
      <div className="absolute inset-0">
        {isVideo && mediaUrl ? (
          <VideoMedia
            url={mediaUrl}
            post={item as any}
            visible={isVideoPlaying}
            globalSoundEnabled={soundEnabled}
          />
        ) : mediaUrl ? (
          <ImageWithFallback
            src={mediaUrl}
            alt={item.content || 'Post'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-purple-900/50 to-blue-900/50" />
        )}
        
        {/* Gradient overlay for readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90" />
      </div>

      {/* Bottom Info Card - Glassmorphic - Expandable */}
      <div
        className={`absolute left-3 right-3 z-30 transition-all duration-500 ease-out sm:left-4 sm:right-4 md:left-auto md:right-6 md:max-w-md lg:max-w-lg ${
          isExpanded
            ? 'bottom-20 top-1/2 sm:bottom-24 md:bottom-28' 
            : 'bottom-3 sm:bottom-4'
        }`}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-black/70 via-black/60 to-black/70 shadow-2xl backdrop-blur-3xl">
          {/* Clickable header to expand/collapse */}
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full p-5 text-left transition-all hover:bg-white/5 sm:p-6 cursor-pointer"
          >
            {/* Author Info */}
            <div className="mb-3 flex items-center gap-3">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  onAuthorClick();
                }}
                className="group relative h-12 w-12 overflow-hidden rounded-full border-2 border-white/30 ring-2 ring-orange-500/20 cursor-pointer transition-all hover:border-orange-500/60 hover:ring-orange-500/40"
              >
                <ImageWithFallback
                  src={item.author_photo || ''}
                  alt={item.author_name || 'User'}
                  className="h-full w-full object-cover transition-transform group-hover:scale-110"
                />
              </div>

              <div className="flex-1">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    onAuthorClick();
                  }}
                  className="cursor-pointer group"
                >
                  <div className="text-base font-bold text-white group-hover:text-orange-500 transition-colors">{item.author_name || 'User'}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {item.author_badge && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                        <Ticket className="h-3 w-3" />
                        {item.author_badge}
                      </div>
                    )}
                    {item.isPromoted && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/30 to-amber-600/30 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        ✨ Promoted
                      </div>
                    )}
                    {item.event_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGetTickets?.(item.event_id!);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 border border-orange-500 px-2.5 py-1 text-[10px] font-bold text-white hover:from-orange-600 hover:to-orange-700 hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-95 cursor-pointer"
                        title="Purchase tickets for this event"
                      >
                        <Ticket className="h-3 w-3" />
                        Get Tickets
                      </button>
                    )}
                  </div>
                </div>
                {item.event_title && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      item.event_id && navigate(`/e/${item.event_id}`);
                    }}
                    className="mt-1.5 cursor-pointer group/event"
                  >
                    <div className="text-xs font-semibold text-white/90 group-hover/event:text-orange-500 transition-colors">
                      📍 {item.event_title}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {item.event_starts_at && (
                        <div className="flex items-center gap-1 text-[10px] text-white/70">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatEventDate(item.event_starts_at)} • {formatEventTime(item.event_starts_at)}
                        </div>
                      )}
                      {item.event_location && (
                        <div className="flex items-center gap-1 text-[10px] text-white/60">
                          <MapPin className="h-2.5 w-2.5" />
                          {item.event_location}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full p-2.5 transition-all hover:bg-white/10 hover:scale-105 active:scale-95">
                    <MoreVertical className="h-5 w-5 text-white/80 hover:text-white transition-colors" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-neutral-900 border-white/10">
                  {!isOwnPost && (
                    <>
                      <DropdownMenuItem 
                        onClick={() => {
                          setSaved(!saved);
                          toast({ title: saved ? 'Removed from saved' : 'Saved!', description: saved ? 'Post removed from saved items' : 'Post saved to your collection' });
                        }}
                        className="text-white hover:bg-white/10 cursor-pointer"
                      >
                        <Bookmark className="h-4 w-4 mr-2" />
                        {saved ? 'Unsave' : 'Save Post'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => {
                          onReport?.();
                          toast({ title: 'Reported', description: 'Thank you for your report. We\'ll review this content.' });
                        }}
                        className="text-red-400 hover:bg-white/10 cursor-pointer"
                      >
                        <Flag className="h-4 w-4 mr-2" />
                        Report
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => {
                          toast({ title: 'Blocked', description: `You won't see posts from this user anymore.` });
                        }}
                        className="text-red-400 hover:bg-white/10 cursor-pointer"
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        Block User
                      </DropdownMenuItem>
                    </>
                  )}
                  {isOwnPost && (
                    <DropdownMenuItem 
                      onClick={() => {
                        toast({ title: 'Delete', description: 'Post deletion coming soon' });
                      }}
                      className="text-red-400 hover:bg-white/10 cursor-pointer"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Delete Post
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Caption */}
            {item.content && (
              <div className="mt-3">
                <p className={`text-sm leading-relaxed text-white/90 ${isExpanded ? '' : 'line-clamp-2'}`}>
                  <span className="font-bold text-white">{item.author_name}</span>{' '}
                  <span className="font-normal">{item.content}</span>
                </p>
              </div>
            )}

            {/* Expand Indicator */}
            <div className="mt-4 flex justify-center">
              <div className="rounded-full bg-white/10 p-1.5 transition-all hover:bg-white/20">
                <ChevronUp 
                  className={`h-4 w-4 text-white/60 transition-all duration-300 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Expanded Content - Interactions (Hidden - using side buttons) */}
          {isExpanded && (
            <div className="border-t border-white/10 bg-black/20 p-6 sm:p-7">
              {/* Action buttons removed - now in side FloatingActions */}

              {/* Event link if post is from an event */}
              {item.event_title && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    item.event_id && navigate(`/e/${item.event_id}`);
                  }}
                  className="mt-4 w-full rounded-full border border-white/20 bg-white/10 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/20 active:scale-95"
                >
                  View Event: {item.event_title}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

