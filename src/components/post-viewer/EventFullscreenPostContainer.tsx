// src/components/post-viewer/EventFullscreenPostContainer.tsx
// Container for viewing posts from a single event (event slug page)

import { useState, useCallback, useEffect } from "react";
import { FullscreenPostViewerShell } from "./FullscreenPostViewerShell";
import { useEventPostsBatch } from "./useEventPostsBatch";
import { CommentsSheet } from "@/features/comments";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { routes } from "@/lib/routes";
import { supabase } from "@/integrations/supabase/client";
import type { ViewerPost, Post } from "./types";

export type EventFullscreenPostContainerProps = {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  postIds: string[];
  initialIndex?: number;
  onCommentCountChange?: (postId: string, newCount: number) => void;
  onPostDelete?: (postId: string) => void;
};

export function EventFullscreenPostContainer({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  postIds,
  initialIndex = 0,
  onCommentCountChange,
  onPostDelete,
}: EventFullscreenPostContainerProps) {
  const { user, profile } = useAuth();
  const [index, setIndex] = useState(initialIndex);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState<Post | null>(null);
  const [hasInit, setHasInit] = useState(false);

  // Load all posts in batch
  const { posts, loading } = useEventPostsBatch(eventId, postIds, isOpen);

  // One-shot initialization: only set index when first opened
  useEffect(() => {
    if (!isOpen) {
      setHasInit(false);
      return;
    }
    if (hasInit) return;

    const maxIndex = postIds.length - 1;
    const clamped = Math.min(Math.max(initialIndex, 0), Math.max(0, maxIndex));
    setIndex(clamped);
    setHasInit(true);
  }, [isOpen, initialIndex, postIds.length, hasInit]);

  // Check if user is organizer (for comments moderation)
  useEffect(() => {
    if (!user?.id || !eventId || !isOpen) return;

    let cancelled = false;
    (async () => {
      try {
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
          if (membership?.role && ["owner", "admin", "editor"].includes(membership.role)) {
            isOrg = true;
          }
        }

        if (!cancelled) setIsOrganizer(isOrg);
      } catch (e) {
        console.error("Error checking organizer status:", e);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, eventId, isOpen]);

  // Handle like
  const handleLike = useCallback(async (post: ViewerPost) => {
    if (!user) {
      toast({ title: "Please sign in to like posts" });
      return null;
    }

    try {
      const { handlePostLike } = await import("@/utils/interactions");
      const result = await handlePostLike(post.id, post.is_liked);
      if (result.success) {
        return {
          newLikedState: result.newLikedState ?? false,
          newLikeCount: result.newLikeCount ?? post.likes_count,
        };
      }
    } catch (e) {
      console.error("Error liking post:", e);
    }
    return null;
  }, [user]);

  // Handle delete
  const handleDelete = useCallback(async (post: ViewerPost) => {
    if (!user || post.author_user_id !== user.id) return;
    if (!confirm("Delete this post? This action cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from("event_posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", post.id);

      if (error) throw error;

      toast({ title: "Post deleted" });
      onPostDelete?.(post.id);
      
      // Navigate to next or close
      if (posts.length <= 1) {
        onClose();
      } else if (index >= posts.length - 1) {
        setIndex(Math.max(0, index - 1));
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete post.",
        variant: "destructive",
      });
    }
  }, [user, posts.length, index, onPostDelete, onClose]);

  // Handle share
  const handleShare = useCallback((post: ViewerPost) => {
    const url = `${window.location.origin}${routes.event(eventId)}?tab=posts&post=${post.id}`;
    navigator.clipboard.writeText(url).then(() =>
      toast({ title: "Link copied", duration: 2000 })
    );
  }, [eventId]);

  // Handle open comments
  const handleOpenComments = useCallback((post: ViewerPost) => {
    // Convert ViewerPost to Post for CommentsSheet
    setActiveCommentPost(post as Post);
    setIsCommentsOpen(true);
  }, []);

  // Update post in local state when comments change
  const handleSetPost = useCallback((updater: ((prev: Post | null) => Post | null) | Post | null) => {
    // CommentsSheet may update the post, but we're using batch loaded posts
    // For now, just handle comment count changes
    if (typeof updater === "function") {
      setActiveCommentPost((prev) => updater(prev));
    } else {
      setActiveCommentPost(updater);
    }
  }, []);

  // Don't render until we have posts loaded
  if (!isOpen) return null;
  
  if (loading && posts.length === 0) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-2 text-white/70">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  const currentPost = posts[index];

  return (
    <>
      <FullscreenPostViewerShell
        isOpen={isOpen}
        onClose={onClose}
        posts={posts}
        index={index}
        setIndex={setIndex}
        onLike={handleLike}
        onDelete={handleDelete}
        onShare={handleShare}
        onOpenComments={handleOpenComments}
        currentUserId={user?.id}
      />

      {/* Comments sheet - outside shell so it can overlay properly */}
      {currentPost && (
        <CommentsSheet
          open={isCommentsOpen}
          onOpenChange={setIsCommentsOpen}
          eventId={eventId}
          post={activeCommentPost || (currentPost as Post)}
          setPost={handleSetPost}
          user={user}
          profileUsername={profile?.username ?? null}
          isOrganizer={isOrganizer}
          onRequestUsername={() => {}}
        />
      )}
    </>
  );
}

