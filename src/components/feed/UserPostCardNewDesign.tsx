import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MoreVertical, Flag, UserX, Bookmark, ChevronUp, MapPin, Calendar, Ticket, Info, ExternalLink, Eye } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import { VideoMedia } from "@/components/feed/VideoMedia";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { FeedItem } from "@/hooks/unifiedFeedTypes";
import { usePostViewCount } from "@/hooks/usePostViewCount";
import { useProfileVisitTracking } from "@/hooks/usePurchaseIntentTracking";
import { isVideoUrl } from "@/utils/mux";
import { FlashbackBadge } from "@/components/flashbacks/FlashbackBadge";
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
  onDelete?: () => void;
  onEventClick?: (eventId: string) => void; // ✅ Navigate to event
  soundEnabled?: boolean;
  isVideoPlaying?: boolean;
  onGetTickets?: (eventId: string) => void;
  onVideoToggle?: () => void;
  onOpenTickets?: (eventId: string) => void;
}

const UserPostCardNewDesignComponent = ({
  item,
  onLike,
  onComment,
  onShare,
  onAuthorClick,
  onReport,
  onDelete,
  onEventClick,
  soundEnabled = false,
  isVideoPlaying = false,
  onGetTickets,
  onVideoToggle,
  onOpenTickets
}: UserPostCardNewDesignProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trackProfileVisit } = useProfileVisitTracking();
  const [liked, setLiked] = useState(item.metrics?.hasLiked || false);
  const [likeCount, setLikeCount] = useState(item.metrics?.likes || 0);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const isOwnPost = user?.id === item.author_id;
  const isOrganizer = item.author_id && item.event_created_by && item.author_id === item.event_created_by;
  const { viewCount, loading: viewCountLoading } = usePostViewCount(item.item_id);

  const mediaUrl = useMemo(() => item.media_urls?.[0] || null, [item.media_urls]);
  const isVideo = useMemo(() => Boolean(mediaUrl && isVideoUrl(mediaUrl!)), [mediaUrl]);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    onLike();
  };

  const handleDeletePost = async () => {
    if (!isOwnPost || deleting) return;
    
    // Confirm deletion
    if (!confirm(`Delete this post? This action cannot be undone.`)) {
      return;
    }
    
    setDeleting(true);
    
    try {
      // Soft delete (set deleted_at, don't actually delete the row)
      const { error } = await supabase
        .from('event_posts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', item.item_id)
        .eq('author_user_id', user?.id); // Security check
      
      if (error) throw error;
      
      toast({ 
        title: 'Post deleted', 
        description: 'Your post has been removed from the feed',
        duration: 3000
      });
      
      // Notify parent to refresh/remove from UI
      onDelete?.();
      
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete post',
        variant: 'destructive',
        duration: 3000
      });
    } finally {
      setDeleting(false);
    }
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/90" />
      </div>

      {/* Flashback Badge - Top Right */}
      {item.event_is_flashback && (
        <div className="absolute top-4 right-4 z-40">
          <FlashbackBadge variant="default" className="text-sm px-4 py-2 shadow-2xl" />
        </div>
      )}

      {/* Bottom Info Card - Glassmorphic - Expandable */}
      <div
        className={`absolute left-3 right-3 z-30 transition-all duration-500 ease-out sm:left-4 sm:right-4 md:left-auto md:right-6 md:max-w-md lg:max-w-lg ${
          isExpanded
            ? 'bottom-20 top-1/2 sm:bottom-24 md:bottom-28' 
            : 'bottom-3 sm:bottom-4'
        }`}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-background/70 via-background/60 to-background/70 shadow-2xl backdrop-blur-3xl">
          {/* Clickable header to expand/collapse */}
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full p-5 text-left transition-all hover:bg-muted/10 sm:p-6 cursor-pointer"
          >
            {/* Author Info */}
            <div className="mb-3 flex items-center gap-3">
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  // 🎯 Track profile visit (moderate purchase intent signal)
                  if (item.author_id) {
                    trackProfileVisit(item.author_id);
                    console.log('[Purchase Intent] 👤 Tracked profile visit for:', item.author_id);
                  }
                  onAuthorClick();
                }}
                className="group relative h-12 w-12 overflow-hidden rounded-full border-2 border-border ring-2 ring-primary/20 cursor-pointer transition-all hover:border-primary/60 hover:ring-primary/40"
              >
                <ImageWithFallback
                  src={
                    // For promoted content, show organization logo instead of user photo
                    item.isPromoted && (item as any).organizer_logo_url
                      ? (item as any).organizer_logo_url
                      : item.author_photo || ''
                  }
                  alt={
                    item.isPromoted && item.event_organizer
                      ? item.event_organizer
                      : item.author_name || 'User'
                  }
                  className="h-full w-full object-cover transition-transform group-hover:scale-110"
                />
              </div>

              <div className="flex-1">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    // 🎯 Track profile visit (moderate purchase intent signal)
                    if (item.author_id) {
                      trackProfileVisit(item.author_id);
                      console.log('[Purchase Intent] 👤 Tracked profile visit for:', item.author_id);
                    }
                    onAuthorClick();
                  }}
                  className="cursor-pointer group"
                >
                  <div className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {/* For promoted content, show organization name instead of user name */}
                    {item.isPromoted && item.event_organizer
                      ? item.event_organizer
                      : item.author_name || 'User'}
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {/* Badge Priority: Promotion > Organizer > Ticket Tier */}
                    {item.isPromoted ? (
                      <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/30 to-amber-600/30 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        ✨ Promotion
                      </div>
                    ) : isOrganizer ? (
                      <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500/30 to-indigo-600/30 border border-blue-400/40 px-2 py-0.5 text-[10px] font-bold text-blue-200">
                        🎖️ ORGANIZER
                      </div>
                    ) : item.author_badge && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-500/20 to-brand-600/20 border border-brand-500/30 px-2 py-0.5 text-[10px] font-bold text-brand-400">
                        <Ticket className="h-3 w-3" />
                        {item.author_badge}
                      </div>
                    )}
                    {item.event_id && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onGetTickets?.(item.event_id!);
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-primary border border-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95 cursor-pointer"
                          title="Purchase tickets for this event"
                        >
                          <Ticket className="h-3 w-3" />
                          Get Tickets
                        </button>
                        {/* Custom CTA for promoted content */}
                        {item.isPromoted && item.promotion?.cta_label && item.promotion?.cta_url && (
                          <a
                            href={item.promotion.cta_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 border border-blue-500 px-2.5 py-1 text-[10px] font-bold text-primary-foreground hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-95 cursor-pointer"
                            title={item.promotion.cta_label}
                          >
                            <Info className="h-3 w-3" />
                            {item.promotion.cta_label}
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {item.event_title && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('🎯 Event title clicked (collapsed):', {
                        eventId: item.event_id,
                        eventTitle: item.event_title,
                        hasCallback: !!onEventClick
                      });
                      
                      if (item.event_id) {
                        if (onEventClick) {
                          onEventClick(item.event_id);
                        } else {
                          console.log('📍 Navigating to event:', `/e/${item.event_id}`);
                          navigate(`/e/${item.event_id}`);
                        }
                      }
                    }}
                    className="mt-1.5 cursor-pointer group/event"
                  >
                    <div className="text-xs font-semibold text-foreground/90 group-hover/event:text-primary transition-colors">
                      📍 {item.event_title}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {item.event_starts_at && (
                        <div className="flex items-center gap-1 text-[10px] text-foreground/70">
                          <Calendar className="h-2.5 w-2.5" />
                          {formatEventDate(item.event_starts_at)} • {formatEventTime(item.event_starts_at)}
                        </div>
                      )}
                      {item.event_location && (
                        <div className="flex items-center gap-1 text-[10px] text-foreground/60">
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
                  <button className="rounded-full p-2.5 transition-all hover:bg-muted/20 hover:scale-105 active:scale-95">
                    <MoreVertical className="h-5 w-5 text-foreground/80 hover:text-foreground transition-colors" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background border-border">
                  {!isOwnPost && (
                    <>
                      <DropdownMenuItem 
                        onClick={() => {
                          setSaved(!saved);
                          toast({ title: saved ? 'Removed from saved' : 'Saved!', description: saved ? 'Post removed from saved items' : 'Post saved to your collection' });
                        }}
                        className="text-foreground hover:bg-muted/20 cursor-pointer"
                      >
                        <Bookmark className="h-4 w-4 mr-2" />
                        {saved ? 'Unsave' : 'Save Post'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => {
                          onReport?.();
                          toast({ title: 'Reported', description: 'Thank you for your report. We\'ll review this content.' });
                        }}
                        className="text-destructive hover:bg-muted/20 cursor-pointer"
                      >
                        <Flag className="h-4 w-4 mr-2" />
                        Report
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => {
                          toast({ title: 'Blocked', description: `You won't see posts from this user anymore.` });
                        }}
                        className="text-destructive hover:bg-muted/20 cursor-pointer"
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        Block User
                      </DropdownMenuItem>
                    </>
                  )}
                  {isOwnPost && (
                    <DropdownMenuItem
                      onClick={handleDeletePost}
                      disabled={deleting}
                      className="text-red-400 hover:bg-white/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      {deleting ? 'Deleting...' : 'Delete Post'}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Caption */}
            {item.content && (
              <div className="mt-3">
                <p className={`text-sm leading-relaxed text-foreground/90 ${isExpanded ? '' : 'line-clamp-2'}`}>
                  <span className="font-bold text-foreground">{item.author_name}</span>{' '}
                  <span className="font-normal">{item.content}</span>
                </p>
              </div>
            )}
            
            {/* Engagement Stats */}
            {!viewCountLoading && viewCount > 0 && (
              <div className="mt-2 flex items-center gap-3 text-[11px] text-foreground/60">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {viewCount.toLocaleString()} {viewCount === 1 ? 'view' : 'views'}
                </span>
              </div>
            )}

            {/* Expand Indicator */}
            <div className="mt-4 flex justify-center">
              <div className="rounded-full bg-muted/20 p-1.5 transition-all hover:bg-muted/30">
                <ChevronUp 
                  className={`h-4 w-4 text-foreground/60 transition-all duration-300 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Expanded Content - Interactions (Hidden - using side buttons) */}
          {isExpanded && (
            <div className="border-t border-border bg-background/20 p-6 sm:p-7">
              {/* Action buttons removed - now in side FloatingActions */}

              {/* Event link if post is from an event */}
              {item.event_title && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('🎯 View Event button clicked (expanded):', {
                      eventId: item.event_id,
                      eventTitle: item.event_title,
                      hasCallback: !!onEventClick
                    });
                    
                    if (item.event_id) {
                      if (onEventClick) {
                        onEventClick(item.event_id);
                      } else {
                        console.log('📍 Navigating to event:', `/e/${item.event_id}`);
                        navigate(`/e/${item.event_id}`);
                      }
                    }
                  }}
                  className="mt-4 w-full rounded-full border border-border bg-muted/20 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted/30 active:scale-95"
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
};

// Memoize to prevent unnecessary re-renders (performance optimization for iOS)
export const UserPostCardNewDesign = React.memo(UserPostCardNewDesignComponent, (prev, next) => {
  // Custom comparison: only re-render if item data actually changed
  return (
    prev.item.item_id === next.item.item_id &&
    prev.item.content === next.item.content &&
    prev.item.metrics?.likes === next.item.metrics?.likes &&
    prev.item.metrics?.comments === next.item.metrics?.comments &&
    prev.isVideoPlaying === next.isVideoPlaying &&
    prev.soundEnabled === next.soundEnabled
  );
});
