// src/features/comments/hooks/useCommentActions.ts
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Comment, Post } from "@/domain/posts";

type UseCommentActionsArgs = {
  post: Post | null;
  setPost: React.Dispatch<React.SetStateAction<Post | null>>;
  user: any;
  profileUsername?: string | null;
  onRequestUsername?: () => void;
};

export function useCommentActions({
  post,
  setPost,
  user,
  profileUsername,
  onRequestUsername,
}: UseCommentActionsArgs) {
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (draft: string, replyingTo?: Comment | null) => {
      if (!post?.id || !draft.trim()) return;

      if (!user) {
        toast({
          title: "Sign in required",
          description: "Please sign in to comment.",
          variant: "destructive",
        });
        return;
      }

      if (!profileUsername) {
        if (onRequestUsername) onRequestUsername();
        else {
          toast({
            title: "Set username",
            description: "Set a username to start commenting.",
          });
        }
        return;
      }

      setSubmitting(true);
      const clientId = `c_${crypto.randomUUID?.() ?? Date.now()}`;
      const mentions = Array.from(draft.matchAll(/@(\w+)/g)).map((m) => m[1]);

      const optimistic: Comment = {
        id: clientId,
        client_id: clientId,
        post_id: post.id,
        text: draft.trim(),
        author_user_id: user.id,
        created_at: new Date().toISOString(),
        author_name: (user.user_metadata?.display_name as string) || "You",
        author_avatar: null,
        likes_count: 0,
        is_liked: false,
        pending: true,
        parent_comment_id: replyingTo?.id ?? null,
        mentions,
        reply_count: 0,
        replies: [],
      };

      setPost((prev) => {
        if (!prev || prev.id !== post.id) return prev;

        const addReply = (comments: Comment[]): Comment[] =>
          comments.map((c) => {
            if (c.id === replyingTo?.id) {
              return {
                ...c,
                replies: [...(c.replies || []), optimistic],
                reply_count: (c.reply_count || 0) + 1,
              };
            }
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: addReply(c.replies) };
            }
            return c;
          });

        if (replyingTo?.id) {
          return {
            ...prev,
            comments: addReply(prev.comments),
          };
        }

        return {
          ...prev,
          comment_count: prev.comment_count + 1,
          comments: [...prev.comments, optimistic],
        };
      });

      try {
        const { data, error } = await supabase
          .from("event_comments")
          .insert({
            post_id: post.id,
            author_user_id: user.id,
            text: optimistic.text,
            client_id: clientId,
            parent_comment_id: replyingTo?.id ?? null,
            mentions,
          })
          .select("id, created_at, client_id")
          .single();

        if (error) throw error;

        setPost((prev) => {
          if (!prev || prev.id !== post.id) return prev;

          const updatePending = (comments: Comment[]): Comment[] =>
            comments.map((c) => {
              if (c.client_id === clientId || c.id === clientId) {
                return {
                  ...c,
                  id: data.id,
                  created_at: data.created_at,
                  pending: false,
                };
              }
              if (c.replies && c.replies.length > 0) {
                return { ...c, replies: updatePending(c.replies) };
              }
              return c;
            });

          return { ...prev, comments: updatePending(prev.comments) };
        });
      } catch (e: any) {
        setPost((prev) => {
          if (!prev || prev.id !== post.id) return prev;

          const removePending = (comments: Comment[]): Comment[] =>
            comments
              .filter((c) => c.client_id !== clientId)
              .map((c) => {
                if (c.replies && c.replies.length > 0) {
                  return { ...c, replies: removePending(c.replies) };
                }
                return c;
              });

          return { ...prev, comments: removePending(prev.comments) };
        });

        toast({
          title: "Error",
          description: e.message || "Failed to add comment.",
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [post, setPost, user, profileUsername, onRequestUsername],
  );

  const toggleLikeComment = useCallback(
    async (commentId: string) => {
      if (!user) {
        toast({
          title: "Sign in required",
          description: "Please sign in to like comments.",
          variant: "destructive",
        });
        return;
      }

      if (!post) return;

      let isLiked = false;
      const findComment = (comments: Comment[]): Comment | null => {
        for (const c of comments) {
          if (c.id === commentId) return c;
          if (c.replies && c.replies.length > 0) {
            const found = findComment(c.replies);
            if (found) return found;
          }
        }
        return null;
      };

      const existing = findComment(post.comments);
      if (existing) isLiked = existing.is_liked;

      const optimistic = !isLiked;

      const updateLike = (comments: Comment[]): Comment[] =>
        comments.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              is_liked: optimistic,
              likes_count: Math.max(
                0,
                c.likes_count + (optimistic ? 1 : -1),
              ),
            };
          }
          if (c.replies && c.replies.length > 0) {
            return { ...c, replies: updateLike(c.replies) };
          }
          return c;
        });

      setPost((prev) =>
        prev ? { ...prev, comments: updateLike(prev.comments) } : prev,
      );

      try {
        if (optimistic) {
          const { error } = await supabase
            .from("event_comment_reactions")
            .insert({
              comment_id: commentId,
              user_id: user.id,
              kind: "like",
            });
          if (error && (error as any).code !== "23505") throw error;
        } else {
          const { error } = await supabase
            .from("event_comment_reactions")
            .delete()
            .eq("comment_id", commentId)
            .eq("user_id", user.id)
            .eq("kind", "like");
          if (error) throw error;
        }
      } catch {
        const rollbackLike = (comments: Comment[]): Comment[] =>
          comments.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                is_liked: !optimistic,
                likes_count: Math.max(
                  0,
                  c.likes_count + (optimistic ? -1 : 1),
                ),
              };
            }
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: rollbackLike(c.replies) };
            }
            return c;
          });

        setPost((prev) =>
          prev ? { ...prev, comments: rollbackLike(prev.comments) } : prev,
        );

        toast({
          title: "Error",
          description: "Failed to update like.",
          variant: "destructive",
        });
      }
    },
    [post, setPost, user],
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!user) {
        toast({
          title: "Sign in required",
          description: "Please sign in to delete comments.",
          variant: "destructive",
        });
        return;
      }

      if (!post) return;

      const findComment = (comments: Comment[]): Comment | null => {
        for (const c of comments) {
          if (c.id === commentId) return c;
          if (c.replies && c.replies.length > 0) {
            const found = findComment(c.replies);
            if (found) return found;
          }
        }
        return null;
      };

      const target = findComment(post.comments);
      if (!target || target.author_user_id !== user.id) {
        toast({
          title: "Not allowed",
          description: "You can only delete your own comments.",
          variant: "destructive",
        });
        return;
      }

      const snapshot = post;

      const deleteRecursive = (comments: Comment[]): Comment[] =>
        comments
          .filter((c) => c.id !== commentId)
          .map((c) => {
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: deleteRecursive(c.replies) };
            }
            return c;
          });

      setPost((prev) =>
        prev
          ? { ...prev, comments: deleteRecursive(prev.comments) }
          : prev,
      );

      try {
        const { error } = await supabase
          .from("event_comments")
          .delete()
          .eq("id", commentId)
          .eq("author_user_id", user.id);

        if (error) throw error;

        toast({
          title: "Deleted",
          description: "Your comment was removed.",
        });
      } catch {
        setPost(snapshot);

        toast({
          title: "Error",
          description: "Failed to delete comment.",
          variant: "destructive",
        });
      }
    },
    [post, setPost, user],
  );

  return { submit, submitting, toggleLikeComment, deleteComment };
}


