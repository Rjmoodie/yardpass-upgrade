import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Dialog,
  DialogPortal,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Heart,
  MessageCircle,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { usePostWithComments, prefetchPost } from "./usePostWithComments";
import { usePostSequenceNavigation } from "./usePostSequenceNavigation";
import type { Post, PostRef } from "./types";

// Re-export for consumers
export type { PostRef } from "./types";
import { CommentsSheet } from "@/features/comments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import { toast } from "@/hooks/use-toast";
import { VideoMedia } from "@/components/feed/VideoMedia";

function isImageUrl(url: string) {
  if (!url) return false;
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(url)) return true;
  if (
    url.includes("supabase.co/storage") &&
    !url.includes(".mp4") &&
    !url.includes(".mov") &&
    !url.includes(".webm")
  )
    return true;
  if (url.includes("image.mux.com")) return true;
  return false;
}

function isVideoUrl(url: string) {
  if (!url) return false;
  if (url.startsWith("mux:")) return true;
  if (url.includes("stream.mux.com")) return true;
  return /\.(mp4|mov|webm)$/i.test(url);
}

type FullscreenPostViewerProps = {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string;              // Default event ID (used when postRefSequence not provided)
  eventTitle: string;
  postId?: string;               // Single-post mode
  mediaPlaybackId?: string;
  postRefSequence?: PostRef[];   // Sequence with per-post eventId (for profile page, mixed events)
  postIdSequence?: string[];     // Legacy: simple ID array (assumes all same eventId)
  initialIndex?: number;
  onCommentCountChange?: (postId: string, newCount: number) => void;
  onPostDelete?: (postId: string) => void;
  onRequestUsername?: () => void;
};

export function FullscreenPostViewer({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  postId,
  mediaPlaybackId,
  postRefSequence,
  postIdSequence,
  initialIndex,
  onCommentCountChange,
  onPostDelete,
  onRequestUsername,
}: FullscreenPostViewerProps) {
  const { user, profile } = useAuth();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true); // Start muted by default
  const videoContainerRef = useRef<HTMLDivElement>(null);
  
  // Swipe state for mobile
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const wheelTimeoutRef = useRef<number | null>(null);
  
  // Cross-fade state: keep previous post visible during transition
  const [displayedPost, setDisplayedPost] = useState<Post | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Normalize sequences: prefer postRefSequence, fall back to postIdSequence with default eventId
  const normalizedSequence = useMemo((): PostRef[] => {
    if (postRefSequence && postRefSequence.length > 0) {
      return postRefSequence;
    }
    if (postIdSequence && postIdSequence.length > 0 && eventId) {
      return postIdSequence.map((id) => ({ id, eventId }));
    }
    return [];
  }, [postRefSequence, postIdSequence, eventId]);

  const totalPosts = normalizedSequence.length;
  const hasSequence = totalPosts > 1;

  // Compute initial index
  const computedInitialIndex = useMemo(() => {
    if (typeof initialIndex === "number" && initialIndex >= 0 && initialIndex < totalPosts) {
      return initialIndex;
    }
    if (postId && normalizedSequence.length > 0) {
      const idx = normalizedSequence.findIndex((ref) => ref.id === postId);
      return idx !== -1 ? idx : 0;
    }
    return 0;
  }, [initialIndex, postId, normalizedSequence, totalPosts]);

  // Navigation hook
  const {
    index: currentIndex,
    setIndex: setCurrentIndex,
    canGoPrev,
    canGoNext,
    goPrev: navPrev,
    goNext: navNext,
  } = usePostSequenceNavigation(totalPosts, computedInitialIndex);

  // Wrap navigation to reset UI state
  const goPrev = useCallback(() => {
    setIsCommentsOpen(false);
    setCaptionExpanded(false);
    navPrev();
  }, [navPrev]);

  const goNext = useCallback(() => {
    setIsCommentsOpen(false);
    setCaptionExpanded(false);
    navNext();
  }, [navNext]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setIsCommentsOpen(false);
      setSwipeStart(null);
      setSwipeOffset(0);
      setCaptionExpanded(false);
    }
  }, [isOpen]);

  // Cleanup wheel timeout
  useEffect(() => {
    return () => {
      if (wheelTimeoutRef.current) {
        window.clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, []);

  // Get active post reference (with correct eventId)
  const activeRef = useMemo((): PostRef | null => {
    if (normalizedSequence.length > 0) {
      const safeIndex =
        currentIndex === null
          ? 0
          : Math.min(Math.max(currentIndex, 0), normalizedSequence.length - 1);
      return normalizedSequence[safeIndex];
    }
    // Single-post mode
    if (postId && eventId) {
      return { id: postId, eventId };
    }
    return null;
  }, [normalizedSequence, currentIndex, postId, eventId]);

  const activePostId = activeRef?.id ?? null;
  const activeEventId = activeRef?.eventId ?? eventId ?? "";

  const { post, setPost, loading } = usePostWithComments(
    activeEventId,  // Use per-post eventId
    activePostId,
    mediaPlaybackId,
    onCommentCountChange
  );

  // Cross-fade: smoothly transition between posts without flash
  useEffect(() => {
    if (!post) return;
    
    // If same post, just update without transition
    if (displayedPost?.id === post.id) {
      setDisplayedPost(post);
      return;
    }
    
    // New post: trigger transition
    setIsTransitioning(true);
    
    // Brief fade-out, then swap, then fade-in
    const timer = setTimeout(() => {
      setDisplayedPost(post);
      setIsTransitioning(false);
    }, 80); // Quick 80ms transition
    
    return () => clearTimeout(timer);
  }, [post, displayedPost?.id]);

  // Reset displayed post when viewer closes
  useEffect(() => {
    if (!isOpen) {
      setDisplayedPost(null);
      setIsTransitioning(false);
    }
  }, [isOpen]);

  // Prefetch adjacent posts for instant swipe navigation
  useEffect(() => {
    if (!hasSequence || currentIndex === null) return;

    const prefetchRefs: PostRef[] = [];
    
    // Prefetch next 2 posts
    if (currentIndex < normalizedSequence.length - 1) {
      prefetchRefs.push(normalizedSequence[currentIndex + 1]);
    }
    if (currentIndex < normalizedSequence.length - 2) {
      prefetchRefs.push(normalizedSequence[currentIndex + 2]);
    }
    
    // Prefetch previous post
    if (currentIndex > 0) {
      prefetchRefs.push(normalizedSequence[currentIndex - 1]);
    }

    // Fire off prefetches with correct eventId per post (non-blocking)
    prefetchRefs.forEach((ref) => {
      prefetchPost(ref.eventId, ref.id);
    });
  }, [hasSequence, currentIndex, normalizedSequence]);

  // Organizer check (for CommentsSheet) - uses activeEventId
  useEffect(() => {
    if (!user?.id || !activeEventId || !isOpen) return;

    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase
          .from("events")
          .select("created_by, owner_context_type, owner_context_id")
          .eq("id", activeEventId)
          .single();

        if (error || cancelled) return;

        let isOrg = false;
        if (data?.created_by === user.id) {
          isOrg = true;
        } else if (
          data?.owner_context_type === "individual" &&
          data.owner_context_id === user.id
        ) {
          isOrg = true;
        } else if (
          data?.owner_context_type === "organization" &&
          data.owner_context_id
        ) {
          const { data: membership } = await supabase
            .from("org_memberships")
            .select("role")
            .eq("org_id", data.owner_context_id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (
            membership?.role &&
            ["owner", "admin", "editor"].includes(membership.role)
          ) {
            isOrg = true;
          }
        }

        if (!cancelled) setIsOrganizer(isOrg);
      } catch (e) {
        console.error("Error checking organizer status:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, activeEventId, isOpen]);

  // Swipe handlers for mobile
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    if (isCommentsOpen || !hasSequence) return;
    const touch = e.touches[0];
    setSwipeStart({ x: touch.clientX, y: touch.clientY });
    setSwipeOffset(0);
  }, [isCommentsOpen, hasSequence]);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    if (!swipeStart || isCommentsOpen || !hasSequence) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    // Horizontal swipe for left/right nav
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setSwipeOffset(deltaX);
    }
  }, [swipeStart, isCommentsOpen, hasSequence]);

  const handleSwipeEnd = useCallback(() => {
    if (!swipeStart || isCommentsOpen || !hasSequence) {
      setSwipeStart(null);
      setSwipeOffset(0);
      return;
    }

    const threshold = window.innerWidth * 0.1; // 10% of screen width (easier swipe)

    if (swipeOffset < -threshold && canGoNext) {
      goNext();
    } else if (swipeOffset > threshold && canGoPrev) {
      goPrev();
    }

    setSwipeStart(null);
    setSwipeOffset(0);
  }, [swipeStart, swipeOffset, isCommentsOpen, hasSequence, canGoPrev, canGoNext, goPrev, goNext]);

  // Wheel navigation
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!hasSequence || isCommentsOpen) return;
    if (Math.abs(e.deltaX) < 25) return;
    if (wheelTimeoutRef.current) return;

    const goingRight = e.deltaX > 0;

    let navigated = false;
    if (goingRight && canGoNext) {
      goNext();
      navigated = true;
    } else if (!goingRight && canGoPrev) {
      goPrev();
      navigated = true;
    }

    if (!navigated) return;

    wheelTimeoutRef.current = window.setTimeout(() => {
      wheelTimeoutRef.current = null;
    }, 400);
  }, [hasSequence, isCommentsOpen, canGoNext, canGoPrev, goNext, goPrev]);

  // Keyboard navigation (left/right)
  useEffect(() => {
    if (!hasSequence || !isOpen || isCommentsOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasSequence, isOpen, isCommentsOpen, goPrev, goNext]);

  const handleDeletePost = useCallback(async () => {
    if (!user || !post) return;
    if (post.author_user_id !== user.id) {
      toast({
        title: "Error",
        description: "You can only delete your own posts.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm("Delete this post? This action cannot be undone.")) return;

    try {
      const { error } = await import("@/integrations/supabase/client").then(
        ({ supabase }) =>
          supabase
            .from("event_posts")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", post.id)
            .eq("author_user_id", user.id)
      );
      if (error) throw error;
      onPostDelete?.(post.id);
      toast({
        title: "Post deleted",
        description: "Your post has been removed.",
        duration: 3000,
      });
      onClose();
    } catch (err: any) {
      console.error("Error deleting post:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to delete post.",
        variant: "destructive",
      });
    }
  }, [user, post, onPostDelete, onClose]);

  const copyPostLink = useCallback(() => {
    const id = post?.id ?? activePostId;
    if (!id || !activeEventId) return;
    const url = `${window.location.origin}${routes.event(
      activeEventId
    )}?tab=posts&post=${id}`;
    navigator.clipboard.writeText(url).then(() =>
      toast({ title: "Link copied", duration: 2000 })
    );
  }, [post?.id, activePostId, activeEventId]);

  // Toggle video sound with immediate feedback
  const handleToggleSound = useCallback(() => {
    const newMutedState = !videoMuted;
    setVideoMuted(newMutedState);

    // Find and control all video/mux-player elements in the container
    requestAnimationFrame(() => {
      if (videoContainerRef.current) {
        const videos = videoContainerRef.current.querySelectorAll<HTMLVideoElement>('video');
        const muxPlayers = videoContainerRef.current.querySelectorAll<any>('mux-player');
        
        videos.forEach(video => {
          video.muted = newMutedState;
          if (!newMutedState && video.paused) {
            video.play().catch(() => {});
          }
        });

        muxPlayers.forEach((player: any) => {
          if (player && typeof player.muted !== 'undefined') {
            player.muted = newMutedState;
            if (!newMutedState && player.paused) {
              player.play().catch(() => {});
            }
          }
        });
      }
    });

    // Haptic feedback (if available)
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }

    // Log for debugging
    console.log(`🔊 [FullscreenPostViewer] Sound ${newMutedState ? 'OFF' : 'ON'}`);
  }, [videoMuted]);

  // 🎬 Smart renderMedia: VideoMedia for videos, big image for photos
  const renderMedia = useCallback((postData: Post | null) => {
    if (!postData?.media_urls || postData.media_urls.length === 0) return null;

    const urls = postData.media_urls.filter(
      (u) => typeof u === "string" && u.trim().length
    );
    if (!urls.length) return null;

    const firstUrl = urls[0];
    const isVideo = isVideoUrl(firstUrl);

    // Tall phone-like frame that uses most of the height
    const mediaFrameCls =
      "relative h-full max-h-[calc(100vh-180px)] aspect-[9/16] max-w-[min(420px,100vw-32px)] sm:max-w-[480px] overflow-hidden rounded-3xl bg-black shadow-2xl";

    // 🎥 VIDEO → use VideoMedia player
    if (isVideo) {
      return (
        <div ref={videoContainerRef} className="flex h-full w-full items-center justify-center bg-black">
          <div className={mediaFrameCls}>
            <VideoMedia
              url={firstUrl}
              post={{
                id: postData.id,
                event_id: activeEventId,  // Per-post eventId for correct analytics
                author_user_id: postData.author_user_id,
                user_profiles: { display_name: postData.author_name },
                text: postData.text,
              }}
              visible={true}
              globalSoundEnabled={!videoMuted}
              hideCaption={true}
              hideControls={true}
            />
          </div>
        </div>
      );
    }

    // 🖼 IMAGE → big centered frame
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <div className="relative h-full max-h-[calc(100vh-180px)] max-w-[min(900px,100vw-32px)] overflow-hidden rounded-3xl bg-black shadow-2xl">
          <img
            src={firstUrl}
            alt="Post media"
            className="h-full w-full object-contain"
            onError={(e) => {
              console.error("[FullscreenPostViewer] Failed to load image:", firstUrl);
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      </div>
    );
  }, [activeEventId, videoMuted]);

  // No key on Dialog - prevents unmount/remount on post change which would reset navigation state
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9998] bg-black data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <DialogPrimitive.Content
          className="fixed inset-0 z-[9999] flex flex-col bg-black
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <VisuallyHidden>
            <DialogTitle>
              {(displayedPost || post) ? `Post by ${(displayedPost || post)?.author_name || "user"}` : "Post viewer"}
            </DialogTitle>
            <DialogDescription>
              {(displayedPost || post)
                ? `View and interact with a post from ${(displayedPost || post)?.author_name || "user"}`
                : "Fullscreen post viewer"}
            </DialogDescription>
          </VisuallyHidden>

          {/* Header - floating over content */}
          <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
            <div 
              className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-b from-black/60 via-black/30 to-transparent transition-opacity duration-100"
              style={{ opacity: isTransitioning ? 0.5 : 1 }}
            >
              {/* Author info - left side (use displayedPost for stable UI) */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {(displayedPost || post) && (
                  <>
                    <div className="flex min-w-0 flex-col">
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            routes.user((displayedPost || post)!.author_user_id),
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                        className="truncate text-left text-sm font-semibold text-white hover:text-white/80"
                        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                      >
                        {(displayedPost || post)?.author_name}
                      </button>
                      <span 
                        className="text-[10px] text-white/70"
                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                      >
                        {formatDistanceToNow(new Date((displayedPost || post)!.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    {(displayedPost || post)?.author_badge && (
                      <Badge
                        variant="neutral"
                        className="shrink-0 border-white/20 bg-white/10 text-[9px] font-medium text-white/90 backdrop-blur-sm"
                      >
                        {(displayedPost || post)?.author_badge}
                      </Badge>
                    )}
                  </>
                )}
              </div>

              {/* Close button - right side, subtle */}
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Media area: swipe, wheel & click-to-nav */}
          <div
            className="relative flex-1 select-none overflow-hidden bg-black"
            onTouchStart={handleSwipeStart}
            onTouchMove={handleSwipeMove}
            onTouchEnd={handleSwipeEnd}
            onWheel={handleWheel}
          >

            <div
              className="flex h-full w-full items-center justify-center px-2 pb-24 pt-16 sm:px-6"
              style={{
                transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
              }}
            >
              {/* Media container with cross-fade transition */}
              <div 
                className="relative flex h-full w-full items-center justify-center transition-opacity duration-100 ease-out"
                style={{
                  opacity: isTransitioning ? 0.3 : (swipeOffset ? Math.max(0.5, 1 - Math.abs(swipeOffset) / 250) : 1),
                }}
              >
                {/* Use displayedPost for stable rendering during transitions */}
                {displayedPost ? (
                  (() => {
                    const hasMedia =
                      displayedPost.media_urls &&
                      Array.isArray(displayedPost.media_urls) &&
                      displayedPost.media_urls.length > 0;

                    if (hasMedia) return renderMedia(displayedPost);

                    return (
                      <div className="text-center text-muted-foreground">
                        <p className="text-sm">No media for this post.</p>
                        {displayedPost.text && (
                          <p className="mx-auto mt-2 max-w-xs text-xs text-muted-foreground/80">
                            {displayedPost.text}
                          </p>
                        )}
                      </div>
                    );
                  })()
                ) : loading ? (
                  /* Show subtle loading only on first load */
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
                  </div>
                ) : null}
              </div>
            </div>


            {/* Swipe indicator (mobile) */}
            {hasSequence && swipeOffset !== 0 && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
                <div className="flex items-center gap-3 rounded-full bg-black/70 px-4 py-2 text-white/90 backdrop-blur-md">
                  {swipeOffset > 0 && canGoPrev && (
                    <>
                      <ChevronLeft className="h-5 w-5" />
                      <span className="text-sm font-medium">Previous</span>
                    </>
                  )}
                  {swipeOffset < 0 && canGoNext && (
                    <>
                      <span className="text-sm font-medium">Next</span>
                      <ChevronRight className="h-5 w-5" />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom actions bar - floating */}
          {(displayedPost || post) && (
            <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none">
              <div
                className="pointer-events-auto flex flex-col gap-2 px-4 py-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-100"
                style={{ 
                  paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
                  opacity: isTransitioning ? 0.5 : 1,
                }}
              >
                {/* Caption - expandable (use displayedPost for stable UI) */}
                {(displayedPost || post)?.text && (
                  <button
                    type="button"
                    onClick={() => setCaptionExpanded(!captionExpanded)}
                    className="text-left"
                  >
                    <p className={`text-[13px] leading-relaxed text-white/90 ${
                      captionExpanded ? '' : 'line-clamp-2'
                    }`}>
                      {(displayedPost || post)?.text}
                    </p>
                    {((displayedPost || post)?.text?.length ?? 0) > 100 && (
                      <span className="text-[11px] text-white/50 mt-0.5">
                        {captionExpanded ? 'Show less' : 'More'}
                      </span>
                    )}
                  </button>
                )}

                {/* Actions row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {/* Like button - compact (use post for interactions, displayedPost for display) */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!post || !user) return;
                        const { handlePostLike } = await import("@/utils/interactions");
                        const result = await handlePostLike(post.id, post.is_liked);
                        if (result.success) {
                          setPost((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  is_liked: result.newLikedState ?? false,
                                  likes_count: result.newLikeCount ?? prev.likes_count,
                                }
                              : null
                          );
                        }
                      }}
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                        (post || displayedPost)?.is_liked
                          ? "bg-red-500/20 text-red-400"
                          : "bg-white/10 text-white/90 hover:bg-white/15"
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${(post || displayedPost)?.is_liked ? "fill-current" : ""}`} />
                      {((post || displayedPost)?.likes_count ?? 0) > 0 && <span>{(post || displayedPost)?.likes_count}</span>}
                    </button>

                    {/* Comment button - compact */}
                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/90 transition-all hover:bg-white/15 active:scale-95"
                      onClick={() => setIsCommentsOpen(true)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>{(post || displayedPost)?.comment_count || 0}</span>
                    </button>

                    {/* Share button - compact */}
                    <button
                      type="button"
                      className="flex items-center justify-center rounded-full bg-white/10 p-1.5 text-white/90 transition-all hover:bg-white/15 active:scale-95"
                      onClick={copyPostLink}
                      aria-label="Share"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>

                    {/* Sound toggle button - for video posts */}
                    <button
                      type="button"
                      onClick={handleToggleSound}
                      className={`flex items-center justify-center rounded-full p-1.5 transition-all active:scale-90 ${
                        videoMuted 
                          ? 'bg-white/10 text-white/60 hover:bg-white/15' 
                          : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                      }`}
                      aria-label={videoMuted ? "Unmute video" : "Mute video"}
                    >
                      {videoMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Delete button - only for author */}
                  {user && (post || displayedPost)?.author_user_id === user.id && (
                    <button
                      type="button"
                      onClick={handleDeletePost}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all hover:bg-red-500/20 hover:text-red-400 active:scale-95"
                      aria-label="Delete post"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Comments sheet */}
          <CommentsSheet
            open={isCommentsOpen}
            onOpenChange={setIsCommentsOpen}
            eventId={activeEventId}  // Per-post eventId
            post={post}
            setPost={setPost}
            user={user}
            profileUsername={profile?.username ?? null}
            isOrganizer={isOrganizer}
            onRequestUsername={onRequestUsername}
          />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
