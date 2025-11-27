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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { usePostWithComments } from "./usePostWithComments";
import type { Post } from "./types";
import { CommentsSheet } from "@/features/comments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import { toast } from "@/hooks/use-toast";

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

type FullscreenPostViewerProps = {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  postId?: string;
  mediaPlaybackId?: string;
  postIdSequence?: string[];
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
  postIdSequence,
  initialIndex,
  onCommentCountChange,
  onPostDelete,
  onRequestUsername,
}: FullscreenPostViewerProps) {
  const { user, profile } = useAuth();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  // Swipe / drag state (vertical)
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Wheel navigation cooldown (global)
  const wheelTimeoutRef = useRef<number | null>(null);

  // Detect touch devices
  useEffect(() => {
    if (typeof window === "undefined") return;
    const touch =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-ignore
      navigator.msMaxTouchPoints > 0;
    setIsTouchDevice(touch);
  }, []);

  const totalPosts = postIdSequence?.length ?? 0;
  const hasSequence = !!postIdSequence && totalPosts > 1;

  // Resolve starting index
  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(null);
      setIsCommentsOpen(false);
      setSwipeStart(null);
      setSwipeOffset(0);
      return;
    }

    if (postIdSequence && postIdSequence.length > 0) {
      if (
        typeof initialIndex === "number" &&
        initialIndex >= 0 &&
        initialIndex < postIdSequence.length
      ) {
        setCurrentIndex(initialIndex);
      } else if (postId) {
        const idx = postIdSequence.indexOf(postId);
        setCurrentIndex(idx !== -1 ? idx : 0);
      } else {
        setCurrentIndex(0);
      }
    } else {
      setCurrentIndex(null);
    }
  }, [isOpen, postIdSequence, initialIndex, postId]);

  // Cleanup wheel cooldown on unmount
  useEffect(() => {
    return () => {
      if (wheelTimeoutRef.current) {
        window.clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, []);

  const activePostId = useMemo(() => {
    if (postIdSequence && postIdSequence.length > 0) {
      const safeIndex =
        currentIndex === null
          ? 0
          : Math.min(Math.max(currentIndex, 0), postIdSequence.length - 1);
      return postIdSequence[safeIndex];
    }
    // Single-post mode
    return postId ?? null;
  }, [postIdSequence, currentIndex, postId]);

  const { post, setPost, loading } = usePostWithComments(
    eventId,
    activePostId,
    mediaPlaybackId,
    onCommentCountChange,
  );

  const [isOrganizer, setIsOrganizer] = useState(false);

  // Organizer check
  useEffect(() => {
    if (!user?.id || !eventId || !isOpen) return;

    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase
          .from("events")
          .select("created_by, owner_context_type, owner_context_id")
          .eq("id", eventId)
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
  }, [user?.id, eventId, isOpen]);

  const canGoPrev =
    hasSequence && currentIndex !== null && currentIndex > 0;
  const canGoNext =
    hasSequence &&
    currentIndex !== null &&
    currentIndex < totalPosts - 1;

  const goPrev = useCallback(() => {
    if (!canGoPrev || currentIndex === null || !hasSequence) return;
    setIsCommentsOpen(false);
    setCurrentIndex(currentIndex - 1);
  }, [canGoPrev, currentIndex, hasSequence]);

  const goNext = useCallback(() => {
    if (!canGoNext || currentIndex === null || !hasSequence) return;
    setIsCommentsOpen(false);
    setCurrentIndex(currentIndex + 1);
  }, [canGoNext, currentIndex, hasSequence]);

  // --- Swipe / drag handlers (vertical, touch-only) -----------------------------

  const handleSwipeStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isTouchDevice || isCommentsOpen || !hasSequence) return;

      const touch = e.touches[0];
      setSwipeStart({ x: touch.clientX, y: touch.clientY });
      setSwipeOffset(0);
    },
    [isTouchDevice, isCommentsOpen, hasSequence],
  );

  const handleSwipeMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isTouchDevice || !swipeStart || isCommentsOpen || !hasSequence) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - swipeStart.x;
      const deltaY = touch.clientY - swipeStart.y;

      // only treat mostly-vertical as swipe
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        setSwipeOffset(deltaY);
      }
    },
    [isTouchDevice, swipeStart, isCommentsOpen, hasSequence],
  );

  const handleSwipeEnd = useCallback(() => {
    if (!isTouchDevice || !swipeStart || isCommentsOpen || !hasSequence) {
      setSwipeStart(null);
      setSwipeOffset(0);
      return;
    }

    const threshold = window.innerHeight * 0.10; // 10% instead of 18%

    if (swipeOffset > threshold && canGoPrev) {
      goPrev();
    } else if (swipeOffset < -threshold && canGoNext) {
      goNext();
    }

    setSwipeStart(null);
    setSwipeOffset(0);
  }, [
    isTouchDevice,
    swipeStart,
    swipeOffset,
    isCommentsOpen,
    hasSequence,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
  ]);

  // --- Wheel navigation (desktop scroll-to-next) -------------------

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!hasSequence || isCommentsOpen) return;

      if (Math.abs(e.deltaY) < 25) return; // more sensitive

      if (wheelTimeoutRef.current) return;

      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {
        // ignore
      }

      const goingDown = e.deltaY > 0;

      let navigated = false;
      if (goingDown && canGoNext) {
        goNext();
        navigated = true;
      } else if (!goingDown && canGoPrev) {
        goPrev();
        navigated = true;
      }

      if (!navigated) return;

      wheelTimeoutRef.current = window.setTimeout(() => {
        wheelTimeoutRef.current = null;
      }, 500);
    },
    [hasSequence, isCommentsOpen, canGoNext, canGoPrev, goNext, goPrev],
  );

  // Keyboard navigation (vertical, only when comments closed)
  useEffect(() => {
    if (!hasSequence || !isOpen || isCommentsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowDown") {
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
            .eq("author_user_id", user.id),
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
    if (!id) return;
    const url = `${window.location.origin}${routes.event(
      eventId,
    )}?tab=posts&post=${id}`;
    navigator.clipboard.writeText(url).then(() =>
      toast({ title: "Link copied", duration: 2000 }),
    );
  }, [post?.id, activePostId, eventId]);

  const VIDEO_PLACEHOLDER = "/images/video-placeholder.jpg"; // fallback thumbnail

  const renderMedia = useCallback((urls: string[]) => {
    if (!urls?.length) return null;

    const validUrls = urls.filter(
      (url) => url && typeof url === "string" && url.trim().length > 0,
    );
    if (!validUrls.length) return null;

    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        {validUrls.map((raw, idx) => {
          const processedUrl = raw.startsWith("mux:")
            ? raw.replace("mux:", "https://stream.mux.com/") + ".m3u8"
            : raw;

          const isMuxSource =
            processedUrl.includes("stream.mux.com") &&
            processedUrl.includes(".m3u8");

          const isVideoFile = /\.(mp4|mov|webm)$/i.test(processedUrl);
          const isImageFile = isImageUrl(processedUrl);

          const wrapperCls =
            "relative flex h-full w-full items-center justify-center";
          const mediaCls = "relative mx-auto w-full max-w-3xl aspect-video";

          // --- MUX HLS ---
          if (isMuxSource || raw.startsWith("mux:")) {
            const playbackId = raw.startsWith("mux:")
              ? raw.replace("mux:", "")
              : processedUrl.split("/").pop()?.replace(".m3u8", "") || "";

            const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
            const posterUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&width=800&fit_mode=smartcrop`;

            return (
              <div key={idx} className={wrapperCls}>
                <div className={mediaCls}>
                  <video
                    className="h-full w-full object-contain"
                    controls
                    playsInline
                    muted
                    preload="metadata"
                    poster={posterUrl}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                    }}
                  >
                    <source src={hlsUrl} type="application/x-mpegURL" />
                    <source
                      src={`https://stream.mux.com/${playbackId}/medium.mp4`}
                      type="video/mp4"
                    />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            );
          }

          // --- File video (mp4/mov/webm) ---
          if (isVideoFile) {
            // If you generate thumbnails server-side, replace this with
            // your own mapping (e.g. store thumbnail_url next to media url).
            const guessedThumb = processedUrl.replace(
              /\.(mp4|mov|webm)$/i,
              ".jpg",
            );

            const posterUrl = guessedThumb || VIDEO_PLACEHOLDER;

            return (
              <div key={idx} className={wrapperCls}>
                <div className={mediaCls}>
                  <video
                    className="h-full w-full object-contain"
                    controls
                    playsInline
                    muted
                    preload="metadata"
                    src={processedUrl}
                    poster={posterUrl}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                    }}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            );
          }

          // --- Image ---
          if (isImageFile) {
            return (
              <div key={idx} className={wrapperCls}>
                <div className={mediaCls}>
                  <img
                    src={processedUrl}
                    alt="Post media"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      console.error(
                        "[FullscreenPostViewer] Failed to load image:",
                        processedUrl,
                      );
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
    );
  }, []);

  const dialogKey = `fullscreen-post-viewer-${eventId}-${
    activePostId ?? "loading"
  }`;
  const canComment = !!profile?.username;

  return (
    <Dialog key={dialogKey} open={isOpen} onOpenChange={onClose}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9998] bg-black data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <DialogPrimitive.Content
          className="fixed inset-0 z-[9999] m-0 flex h-[100vh] w-full flex-col overflow-hidden bg-black p-0
                     data-[state=open]:animate-in data-[state=closed]:animate-out
                     data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <VisuallyHidden>
            <DialogTitle>
              {post
                ? `Post by ${post.author_name || "user"}`
                : "Post viewer"}
            </DialogTitle>
            <DialogDescription>
              {post
                ? `View and interact with post from ${post.author_name || "user"}`
                : "Fullscreen post viewer"}
            </DialogDescription>
          </VisuallyHidden>

          {/* Centered container */}
          <div className="relative mx-auto flex h-full w-full max-w-full flex-col sm:max-w-6xl">
            {/* Top overlay header */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
              <div
                className="
                  pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-2
                  px-3 sm:px-4 py-3
                  bg-gradient-to-b from-black/80 via-black/40 to-transparent
                  backdrop-blur-sm
                  animate-in fade-in slide-in-from-top-4 duration-200
                "
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
                    onClick={onClose}
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </Button>

                  {post && (
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            routes.user(post.author_user_id),
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                        className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/60"
                        aria-label={`Open ${post.author_name || "user"} profile in new tab`}
                      >
                        <Avatar className="h-8 w-8 ring-2 ring-white/40">
                          <AvatarImage src={post.author_avatar || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-xs">
                            {post.author_name?.charAt(0) || "A"}
                          </AvatarFallback>
                        </Avatar>
                      </button>

                      <div className="flex min-w-0 flex-col">
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              routes.user(post.author_user_id),
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                          className="truncate text-left text-[13px] font-semibold text-white hover:text-primary-foreground/80"
                          title="View profile"
                        >
                          {post.author_name}
                        </button>
                        <span className="text-[11px] text-white/70">
                          {formatDistanceToNow(new Date(post.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>

                      {post.author_badge && (
                        <Badge
                          variant="neutral"
                          className="border-white/50 bg-white/10 text-[10px] text-white/90"
                        >
                          {post.author_badge}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {hasSequence && currentIndex !== null && (
                    <span className="min-w-[52px] text-center text-[11px] text-white/80">
                      {currentIndex + 1}/{totalPosts}
                    </span>
                  )}

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60"
                    onClick={copyPostLink}
                    aria-label="Copy post link"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Media area: swipe + wheel */}
            <div
              className="relative flex-1 select-none overflow-hidden bg-black touch-none"
              onTouchStart={handleSwipeStart}
              onTouchMove={handleSwipeMove}
              onTouchEnd={handleSwipeEnd}
              onWheel={handleWheel}
            >
              <div
                className="flex h-full w-full items-center justify-center px-2 pb-2 pt-12 transition-transform duration-150 ease-out sm:px-4 sm:pb-4 sm:pt-14"
                style={{
                  transform: swipeOffset
                    ? `translateY(${swipeOffset}px)`
                    : undefined,
                  opacity: swipeOffset
                    ? Math.max(0.6, 1 - Math.abs(swipeOffset) / 250)
                    : undefined,
                }}
              >
                <div className="relative flex h-full w-full max-h-[80vh] items-center justify-center">
                  {loading || (activePostId && !post) ? (
                    <div className="flex flex-col items-center gap-2 text-sm text-white/70">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                      <span>Loading post…</span>
                    </div>
                  ) : post ? (
                    (() => {
                      const hasMedia =
                        post.media_urls &&
                        Array.isArray(post.media_urls) &&
                        post.media_urls.length > 0;

                      if (hasMedia) {
                        return renderMedia(post.media_urls);
                      }
                      return (
                        <div className="text-center text-muted-foreground">
                          <p className="text-sm">No media for this post.</p>
                          {post.text && (
                            <p className="mx-auto mt-2 max-w-xs text-xs text-muted-foreground/80">
                              {post.text}
                            </p>
                          )}
                        </div>
                      );
                    })()
                  ) : activePostId ? (
                    <div className="flex flex-col items-center gap-2 text-sm text-white/70">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                      <span>Loading post…</span>
                    </div>
                  ) : (
                    <div className="text-sm text-white/70">
                      No post selected
                    </div>
                  )}
                </div>
              </div>

              {/* Swipe indicator */}
              {hasSequence && swipeOffset !== 0 && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
                  <div className="flex flex-col items-center gap-2 text-white/80">
                    {swipeOffset > 0 && canGoPrev && (
                      <>
                        <ChevronLeft className="h-6 w-6 rotate-90" />
                        <span className="text-sm font-medium">Previous</span>
                      </>
                    )}
                    {swipeOffset < 0 && canGoNext && (
                      <>
                        <ChevronRight className="h-6 w-6 rotate-90" />
                        <span className="text-sm font-medium">Next</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom meta bar */}
            {post && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
                <div
                  className="
                    pointer-events-auto mx-auto flex max-w-6xl flex-col gap-2
                    px-4 pb-4 pt-3
                    border-t border-white/10
                    bg-gradient-to-t from-black/85 via-black/60 to-transparent
                    backdrop-blur-sm
                    animate-in fade-in slide-in-from-bottom-4 duration-200
                  "
                  style={{
                    paddingBottom:
                      "calc(1rem + env(safe-area-inset-bottom, 0px))",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!post || !user) return;
                          const { handlePostLike } =
                            await import("@/utils/interactions");
                          const result = await handlePostLike(
                            post.id,
                            post.is_liked,
                          );
                          if (result.success) {
                            setPost((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    is_liked:
                                      result.newLikedState ?? false,
                                    likes_count:
                                      result.newLikeCount ??
                                      prev.likes_count,
                                  }
                                : null,
                            );
                          }
                        }}
                        className={`inline-flex items-center gap-1 transition-colors ${
                          post.is_liked
                            ? "text-red-500 hover:text-red-400"
                            : "text-white/90 hover:text-white"
                        }`}
                      >
                        <Heart
                          className={`h-5 w-5 ${
                            post.is_liked ? "fill-current" : ""
                          }`}
                        />
                        {post.likes_count > 0 && (
                          <span className="text-xs">
                            {post.likes_count}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-white/90 transition-colors hover:text-white"
                        onClick={() => setIsCommentsOpen(true)}
                      >
                        <MessageCircle className="h-5 w-5" />
                        <span className="text-xs">
                          {post.comment_count || 0}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {user && post.author_user_id === user.id && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-3 text-xs text-white/80 hover:text-destructive"
                          onClick={handleDeletePost}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>

                  {post.text && (
                    <div className="max-h-[40px] overflow-hidden">
                      <p className="line-clamp-2 whitespace-pre-wrap text-xs text-white/90">
                        {post.text}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Comments sheet */}
          <CommentsSheet
            open={isCommentsOpen}
            onOpenChange={setIsCommentsOpen}
            eventId={eventId}
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
