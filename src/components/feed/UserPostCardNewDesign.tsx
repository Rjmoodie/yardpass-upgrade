import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Share2, MoreVertical, Flag, UserX, Bookmark, ChevronUp } from "lucide-react";
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
}

export function UserPostCardNewDesign({
  item,
  onLike,
  onComment,
  onShare,
  onAuthorClick,
  onReport,
  soundEnabled = false,
  isVideoPlaying = false
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

  const truncatedCaption = (item.content_text || '').length > 120 
    ? (item.content_text || '').slice(0, 120) + "..." 
    : (item.content_text || '');

  return (
    <div className="relative h-full w-full">
      {/* Full Screen Media Background */}
      <div className="absolute inset-0">
        {isVideo && mediaUrl ? (
          <VideoMedia
            url={mediaUrl}
            post={item as any}
            visible={isVideoPlaying}
          />
        ) : mediaUrl ? (
          <ImageWithFallback
            src={mediaUrl}
            alt={item.content_text || 'Post'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-purple-900/50 to-blue-900/50" />
        )}
        
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90" />
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
                  <div className="text-xs text-white/70 font-medium">
                    {item.event_title && `${item.event_title} • `}
                    {item.created_at && new Date(item.created_at).toLocaleDateString()}
                  </div>
                </div>
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
            {item.content_text && (
              <div className="mt-3">
                <p className={`text-sm leading-relaxed text-white/90 ${isExpanded ? '' : 'line-clamp-2'}`}>
                  <span className="font-bold text-white">{item.author_name}</span>{' '}
                  <span className="font-normal">{item.content_text}</span>
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

          {/* Expanded Content - Interactions */}
          {isExpanded && (
            <div className="border-t border-white/10 bg-black/20 p-6 sm:p-7">
              {/* Action buttons when expanded */}
              <div className="flex items-center justify-around gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike();
                  }}
                  className="group flex flex-col items-center gap-2 rounded-2xl px-6 py-3 transition-all hover:scale-105 hover:bg-white/5 active:scale-95"
                >
                  <Heart
                    className={`h-7 w-7 transition-all ${
                      liked ? "fill-red-500 text-red-500 scale-110" : "text-white group-hover:text-red-500"
                    }`}
                  />
                  <span className="text-sm font-bold text-white/90">{likeCount}</span>
                </button>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onComment();
                  }}
                  className="group flex flex-col items-center gap-2 rounded-2xl px-6 py-3 transition-all hover:scale-105 hover:bg-white/5 active:scale-95"
                >
                  <MessageCircle className="h-7 w-7 text-white transition-colors group-hover:text-blue-400" />
                  <span className="text-sm font-bold text-white/90">{item.metrics?.comments || 0}</span>
                </button>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare();
                  }}
                  className="group flex flex-col items-center gap-2 rounded-2xl px-6 py-3 transition-all hover:scale-105 hover:bg-white/5 active:scale-95"
                >
                  <Share2 className="h-7 w-7 text-white transition-colors group-hover:text-green-400" />
                  <span className="text-sm font-bold text-white/90">Share</span>
                </button>
              </div>

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

