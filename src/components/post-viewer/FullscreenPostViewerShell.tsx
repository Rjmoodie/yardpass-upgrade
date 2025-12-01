// src/components/post-viewer/FullscreenPostViewerShell.tsx
// Pure UI component - no data fetching, no Supabase
// Receives fully-formed posts from container components

import { useCallback, useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogPortal,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Heart,
  MessageCircle,
  Share2,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import { VideoMedia } from "@/components/feed/VideoMedia";
import type { ViewerPost } from "./types";

function isVideoUrl(url: string) {
  if (!url) return false;
  if (url.startsWith("mux:")) return true;
  if (url.includes("stream.mux.com")) return true;
  return /\.(mp4|mov|webm)$/i.test(url);
}

export type FullscreenPostViewerShellProps = {
  isOpen: boolean;
  onClose: () => void;
  posts: ViewerPost[];
  index: number;
  setIndex: (i: number) => void;
  // Action callbacks
  onLike?: (post: ViewerPost) => Promise<{ newLikedState: boolean; newLikeCount: number } | null>;
  onDelete?: (post: ViewerPost) => void;
  onShare?: (post: ViewerPost) => void;
  onOpenComments?: (post: ViewerPost) => void;
  // Optional: current user for showing delete button
  currentUserId?: string;
};

export function FullscreenPostViewerShell({
  isOpen,
  onClose,
  posts,
  index,
  setIndex,
  onLike,
  onDelete,
  onShare,
  onOpenComments,
  currentUserId,
}: FullscreenPostViewerShellProps) {
  // Internal index state for smooth navigation
  const [internalIndex, setInternalIndex] = useState(index);
  
  // Sync internal index when prop changes (e.g., on open)
  useEffect(() => {
    setInternalIndex(index);
  }, [index]);

  // Swipe state
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const wheelTimeoutRef = useRef<number | null>(null);

  // Local like state (optimistic UI)
  const [localLikeState, setLocalLikeState] = useState<Record<string, { is_liked: boolean; likes_count: number }>>({});

  const totalPosts = posts.length;
  const hasSequence = totalPosts > 1;
  const post = posts[internalIndex] ?? null;

  const canGoPrev = internalIndex > 0;
  const canGoNext = internalIndex < totalPosts - 1;

  // Use refs for stable callbacks
  const indexRef = useRef(internalIndex);
  const totalRef = useRef(totalPosts);
  indexRef.current = internalIndex;
  totalRef.current = totalPosts;

  // Navigation functions - update both internal state and notify parent
  const goPrev = useCallback(() => {
    if (indexRef.current <= 0) return;
    const newIndex = indexRef.current - 1;
    setCaptionExpanded(false);
    setInternalIndex(newIndex);
    setIndex(newIndex);
  }, [setIndex]);

  const goNext = useCallback(() => {
    if (indexRef.current >= totalRef.current - 1) return;
    const newIndex = indexRef.current + 1;
    setCaptionExpanded(false);
    setInternalIndex(newIndex);
    setIndex(newIndex);
  }, [setIndex]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
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

  // Use ref for swipe state to avoid callback recreation
  const swipeRef = useRef({ start: null as { x: number; y: number } | null, offset: 0 });

  // Swipe handlers - optimized with refs
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    if (totalRef.current <= 1) return;
    const touch = e.touches[0];
    swipeRef.current.start = { x: touch.clientX, y: touch.clientY };
    swipeRef.current.offset = 0;
    setSwipeStart({ x: touch.clientX, y: touch.clientY });
    setSwipeOffset(0);
  }, []);

  const handleSwipeMove = useCallback((e: React.TouchEvent) => {
    const start = swipeRef.current.start;
    if (!start || totalRef.current <= 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      swipeRef.current.offset = deltaX;
      setSwipeOffset(deltaX);
    }
  }, []);

  const handleSwipeEnd = useCallback(() => {
    const start = swipeRef.current.start;
    const offset = swipeRef.current.offset;
    
    // Clear refs and state immediately
    swipeRef.current.start = null;
    swipeRef.current.offset = 0;
    setSwipeStart(null);
    setSwipeOffset(0);
    
    if (!start || totalRef.current <= 1) {
      return;
    }

    const threshold = window.innerWidth * 0.1;
    const idx = indexRef.current;
    const total = totalRef.current;

    // Navigate based on swipe direction
    if (offset < -threshold && idx < total - 1) {
      goNext();
    } else if (offset > threshold && idx > 0) {
      goPrev();
    }
  }, [goPrev, goNext]);

  // Wheel navigation - uses refs for stable callback
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (totalRef.current <= 1) return;
    if (Math.abs(e.deltaX) < 25) return;
    if (wheelTimeoutRef.current) return;

    const goingRight = e.deltaX > 0;
    const idx = indexRef.current;
    const total = totalRef.current;

    let navigated = false;
    if (goingRight && idx < total - 1) {
      goNext();
      navigated = true;
    } else if (!goingRight && idx > 0) {
      goPrev();
      navigated = true;
    }

    if (!navigated) return;

    wheelTimeoutRef.current = window.setTimeout(() => {
      wheelTimeoutRef.current = null;
    }, 400);
  }, [goNext, goPrev]);

  // Keyboard navigation - stable handlers
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (totalRef.current <= 1) return;
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
  }, [isOpen, goPrev, goNext]);

  // Handle like with optimistic update
  const handleLike = useCallback(async () => {
    if (!post || !onLike) return;
    
    // Optimistic update
    const currentState = localLikeState[post.id] ?? { is_liked: post.is_liked, likes_count: post.likes_count };
    const newIsLiked = !currentState.is_liked;
    const newCount = newIsLiked ? currentState.likes_count + 1 : Math.max(0, currentState.likes_count - 1);
    
    setLocalLikeState(prev => ({
      ...prev,
      [post.id]: { is_liked: newIsLiked, likes_count: newCount }
    }));

    const result = await onLike(post);
    if (result) {
      setLocalLikeState(prev => ({
        ...prev,
        [post.id]: { is_liked: result.newLikedState, likes_count: result.newLikeCount }
      }));
    }
  }, [post, onLike, localLikeState]);

  // Get like state (local or from post)
  const getLikeState = (p: ViewerPost) => {
    return localLikeState[p.id] ?? { is_liked: p.is_liked, likes_count: p.likes_count };
  };

  // Render media - optimized layout that fills screen
  const renderMedia = useCallback((postData: ViewerPost, isCurrentPost: boolean) => {
    if (!postData?.media_urls || postData.media_urls.length === 0) return null;

    const urls = postData.media_urls.filter(
      (u) => typeof u === "string" && u.trim().length
    );
    if (!urls.length) return null;

    const firstUrl = urls[0];
    const isVideo = isVideoUrl(firstUrl);

    // Container that fills screen with optional blur background
    const wrapperCls = "relative flex h-full w-full items-center justify-center";
    // Frame optimized for mobile-first full-screen experience
    const mediaFrameCls = "relative h-full max-h-[100dvh] w-full max-w-[min(460px,100vw)] overflow-hidden rounded-2xl shadow-2xl";

    if (isVideo) {
      return (
        <div className={wrapperCls}>
          <div className={mediaFrameCls}>
            <VideoMedia
              url={firstUrl}
              post={{
                id: postData.id,
                event_id: postData.event_id,
                author_user_id: postData.author_user_id,
                user_profiles: { display_name: postData.author_name },
                text: postData.text,
              }}
              visible={isCurrentPost}
              globalSoundEnabled={true}
              hideCaption={true}
              hideControls={true}
            />
          </div>
        </div>
      );
    }

    // Image - fills screen cleanly
    return (
      <div className={wrapperCls}>
        <div className="relative h-full max-h-[100dvh] max-w-[min(900px,100vw)] overflow-hidden rounded-2xl shadow-2xl">
          <img
            src={firstUrl}
            alt="Post media"
            className="h-full w-full object-contain"
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      </div>
    );
  }, []);

  if (!post) return null;

  const likeState = getLikeState(post);

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
              Post by {post.author_name || "user"}
            </DialogTitle>
            <DialogDescription>
              View and interact with a post from {post.author_name || "user"}
            </DialogDescription>
          </VisuallyHidden>

          {/* Header */}
          <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
            <div className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-b from-black/60 via-black/30 to-transparent">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="flex min-w-0 flex-col">
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        routes.user(post.author_user_id),
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="truncate text-left text-sm font-semibold text-white hover:text-white/80"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                  >
                    {post.author_name}
                  </button>
                  <span 
                    className="text-[10px] text-white/70"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                  >
                    {formatDistanceToNow(new Date(post.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                {post.author_badge && (
                  <Badge
                    variant="neutral"
                    className="shrink-0 border-white/20 bg-white/10 text-[9px] font-medium text-white/90 backdrop-blur-sm"
                  >
                    {post.author_badge}
                  </Badge>
                )}
              </div>

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

          {/* Media area */}
          <div
            className="relative flex-1 select-none overflow-hidden bg-black"
            onTouchStart={handleSwipeStart}
            onTouchMove={handleSwipeMove}
            onTouchEnd={handleSwipeEnd}
            onWheel={handleWheel}
          >
            {/* Invisible tap zones for navigation - 25% width each side */}
            {hasSequence && (
              <>
                <button
                  type="button"
                  aria-label="Previous post"
                  disabled={!canGoPrev}
                  onClick={goPrev}
                  className="absolute inset-y-16 left-0 z-30 w-[25%] 
                             disabled:pointer-events-none"
                />
                <button
                  type="button"
                  aria-label="Next post"
                  disabled={!canGoNext}
                  onClick={goNext}
                  className="absolute inset-y-16 right-0 z-30 w-[25%]
                             disabled:pointer-events-none"
                />
              </>
            )}

            {/* Swipe container with spring transition */}
            <div
              className="flex h-full w-full items-center justify-center px-2 pb-20 pt-14 sm:px-4"
              style={{
                transform: `translateX(${swipeOffset}px)`,
                transition: swipeOffset === 0 ? "transform 180ms ease-out" : "none",
                opacity: swipeOffset ? Math.max(0.6, 1 - Math.abs(swipeOffset) / 300) : 1,
              }}
            >
              <div className="relative flex h-full w-full items-center justify-center">
                {post.media_urls && post.media_urls.length > 0 ? (
                  renderMedia(post, true)
                ) : (
                  <div className="text-center text-muted-foreground">
                    <p className="text-sm">No media for this post.</p>
                    {post.text && (
                      <p className="mx-auto mt-2 max-w-xs text-xs text-muted-foreground/80">
                        {post.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Swipe indicator */}
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

          {/* Bottom actions bar */}
          <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none">
            <div
              className="pointer-events-auto flex flex-col gap-2 px-4 py-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent"
              style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
            >
              {/* Caption */}
              {post.text && (
                <button
                  type="button"
                  onClick={() => setCaptionExpanded(!captionExpanded)}
                  className="text-left"
                >
                  <p className={`text-[13px] leading-relaxed text-white/90 ${
                    captionExpanded ? '' : 'line-clamp-2'
                  }`}>
                    {post.text}
                  </p>
                  {post.text.length > 100 && (
                    <span className="text-[11px] text-white/50 mt-0.5">
                      {captionExpanded ? 'Show less' : 'More'}
                    </span>
                  )}
                </button>
              )}

              {/* Actions row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {/* Like button */}
                  <button
                    type="button"
                    onClick={handleLike}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                      likeState.is_liked
                        ? "bg-red-500/20 text-red-400"
                        : "bg-white/10 text-white/90 hover:bg-white/15"
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${likeState.is_liked ? "fill-current" : ""}`} />
                    {likeState.likes_count > 0 && <span>{likeState.likes_count}</span>}
                  </button>

                  {/* Comment button */}
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white/90 transition-all hover:bg-white/15 active:scale-95"
                    onClick={() => onOpenComments?.(post)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>{post.comment_count || 0}</span>
                  </button>

                  {/* Share button */}
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-full bg-white/10 p-1.5 text-white/90 transition-all hover:bg-white/15 active:scale-95"
                    onClick={() => onShare?.(post)}
                    aria-label="Share"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Delete button */}
                {currentUserId && post.author_user_id === currentUserId && onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(post)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all hover:bg-red-500/20 hover:text-red-400 active:scale-95"
                    aria-label="Delete post"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

