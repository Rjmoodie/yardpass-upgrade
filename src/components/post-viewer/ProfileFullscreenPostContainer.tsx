// src/components/post-viewer/ProfileFullscreenPostContainer.tsx
// Container for viewing posts from profile page (mixed events)
// Posts are passed in directly since profile already has them loaded

import { useState, useCallback, useEffect } from "react";
import { FullscreenPostViewerShell } from "./FullscreenPostViewerShell";
import { CommentsSheet } from "@/features/comments";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { routes } from "@/lib/routes";
import { supabase } from "@/integrations/supabase/client";
import type { ViewerPost, Post } from "./types";

export type ProfileFullscreenPostContainerProps = {
  isOpen: boolean;
  onClose: () => void;
  posts: ViewerPost[];
  initialIndex?: number;
  onPostDelete?: (postId: string) => void;
  onPostUpdate?: (postId: string, updates: Partial<ViewerPost>) => void;
};

export function ProfileFullscreenPostContainer({
  isOpen,
  onClose,
  posts,
  initialIndex = 0,
  onPostDelete,
  onPostUpdate,
}: ProfileFullscreenPostContainerProps) {
  const { user, profile } = useAuth();
  const [index, setIndex] = useState(initialIndex);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState<Post | null>(null);
  const [hasInit, setHasInit] = useState(false);

  // One-shot initialization: only set index when first opened
  // After that, swiping fully controls the index
  useEffect(() => {
    if (!isOpen) {
      setHasInit(false);
      return;
    }
    if (hasInit) return;

    const maxIndex = posts.length - 1;
    const clamped = Math.min(Math.max(initialIndex, 0), Math.max(0, maxIndex));
    setIndex(clamped);
    setHasInit(true);
  }, [isOpen, initialIndex, posts.length, hasInit]);

  // Get current post's event ID for comments
  const currentPost = posts[index];
  const currentEventId = currentPost?.event_id ?? "";

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
        const updates = {
          is_liked: result.newLikedState ?? false,
          likes_count: result.newLikeCount ?? post.likes_count,
        };
        onPostUpdate?.(post.id, updates);
        return {
          newLikedState: updates.is_liked,
          newLikeCount: updates.likes_count,
        };
      }
    } catch (e) {
      console.error("Error liking post:", e);
    }
    return null;
  }, [user, onPostUpdate]);

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

  // Handle share - uses post's own event_id
  const handleShare = useCallback((post: ViewerPost) => {
    const url = `${window.location.origin}${routes.event(post.event_id)}?tab=posts&post=${post.id}`;
    navigator.clipboard.writeText(url).then(() =>
      toast({ title: "Link copied", duration: 2000 })
    );
  }, []);

  // Handle open comments
  const handleOpenComments = useCallback((post: ViewerPost) => {
    setActiveCommentPost(post as Post);
    setIsCommentsOpen(true);
  }, []);

  // Update post from comments
  const handleSetPost = useCallback((updater: ((prev: Post | null) => Post | null) | Post | null) => {
    if (typeof updater === "function") {
      setActiveCommentPost((prev) => updater(prev));
    } else {
      setActiveCommentPost(updater);
    }
  }, []);

  if (!isOpen || posts.length === 0) return null;

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

      {/* Comments sheet */}
      {currentPost && (
        <CommentsSheet
          open={isCommentsOpen}
          onOpenChange={setIsCommentsOpen}
          eventId={currentEventId}
          post={activeCommentPost || (currentPost as Post)}
          setPost={handleSetPost}
          user={user}
          profileUsername={profile?.username ?? null}
          isOrganizer={false} // Profile page doesn't show organizer features
          onRequestUsername={() => {}}
        />
      )}
    </>
  );
}

