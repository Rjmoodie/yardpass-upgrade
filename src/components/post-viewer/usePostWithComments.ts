// src/components/post-viewer/usePostWithComments.ts
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { muxToHls } from "@/utils/media";
import { useRealtimeComments } from "@/features/comments";
import type { Comment, Post } from "./types";

// Cache to remember if tables don't exist (prevents infinite retry loops)
// Initialize to false since we know these tables don't exist yet
const tableExistenceCache = {
  event_comment_reactions: false as boolean | null,
  event_reactions: false as boolean | null,
};

// Simple post cache for instant navigation (keeps last 10 posts)
const postCache = new Map<string, { post: Post; timestamp: number }>();
const POST_CACHE_TTL = 60_000; // 1 minute
const MAX_CACHE_SIZE = 10;

function getCachedPost(postId: string): Post | null {
  const cached = postCache.get(postId);
  if (!cached) return null;
  // Check if still valid
  if (Date.now() - cached.timestamp > POST_CACHE_TTL) {
    postCache.delete(postId);
    return null;
  }
  return cached.post;
}

function setCachedPost(postId: string, post: Post) {
  // Evict oldest if at capacity
  if (postCache.size >= MAX_CACHE_SIZE) {
    const oldest = [...postCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) postCache.delete(oldest[0]);
  }
  postCache.set(postId, { post, timestamp: Date.now() });
}

// Lightweight prefetch - just loads basic post data into cache
const prefetchingIds = new Set<string>();

export async function prefetchPost(eventId: string, postId: string): Promise<void> {
  // Skip if already cached or currently prefetching
  if (getCachedPost(postId) || prefetchingIds.has(postId)) return;
  
  prefetchingIds.add(postId);
  
  try {
    const { data: postRow, error } = await supabase
      .from("event_posts")
      .select("id, text, author_user_id, created_at, media_urls, like_count, comment_count, ticket_tier_id")
      .eq("id", postId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (error || !postRow) return;

    // Fetch author profile in parallel with tier
    const [profileRes, tierRes] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("user_id, display_name, photo_url")
        .eq("user_id", postRow.author_user_id)
        .maybeSingle(),
      postRow.ticket_tier_id
        ? supabase
            .from("ticket_tiers")
            .select("id, badge_label")
            .eq("id", postRow.ticket_tier_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const authorProfile = profileRes.data;
    const tier = tierRes.data;

    // Build a minimal cached post (without comments - those load on demand)
    const prefetchedPost: Post = {
      id: postRow.id,
      text: postRow.text,
      author_user_id: postRow.author_user_id,
      created_at: postRow.created_at,
      media_urls: (postRow.media_urls ?? []).map(muxToHls),
      author_name: authorProfile?.display_name ?? "Anonymous",
      author_avatar: authorProfile?.photo_url ?? null,
      author_badge: tier?.badge_label ?? null,
      author_is_organizer: false,
      comments: [], // Comments load on demand
      likes_count: postRow.like_count ?? 0,
      is_liked: false, // Will be updated when fully loaded
      comment_count: postRow.comment_count ?? 0,
    };

    setCachedPost(postId, prefetchedPost);
  } catch (e) {
    // Silent fail for prefetch
    console.debug("[prefetchPost] Failed:", e);
  } finally {
    prefetchingIds.delete(postId);
  }
}

async function resolvePostIdFromMedia(eventId: string, playbackId: string) {
  const { data, error } = await supabase
    .from("event_posts")
    .select("id, media_urls")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[resolvePostIdFromMedia] Error:", error);
    throw error;
  }

  for (const row of data ?? []) {
    const arr: string[] = row.media_urls ?? [];
    const hasMatch = arr.some((u) => {
      const exactMux = u === `mux:${playbackId}`;
      const inUrl = u.includes(`/${playbackId}/`) || u.includes(`/${playbackId}.`);
      return exactMux || inUrl;
    });
    if (hasMatch) return row.id;
  }

  return null;
}

export function usePostWithComments(
  eventId: string,
  initialPostId?: string | null,
  mediaPlaybackId?: string,
  onCommentCountChange?: (postId: string, newCount: number) => void,
) {
  const [postId, setPostId] = useState<string | null>(initialPostId ?? null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(false);

  // Use ref for callback to prevent effect loop when parent re-renders
  const onCommentCountChangeRef = useRef(onCommentCountChange);
  useEffect(() => {
    onCommentCountChangeRef.current = onCommentCountChange;
  }, [onCommentCountChange]);

  // Resolve post id from media id (used by player → comments deeplink)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!eventId) return;

      if (initialPostId) {
        setPostId(initialPostId);
        return;
      }
      if (!mediaPlaybackId) return;

      try {
        const id = await resolvePostIdFromMedia(eventId, mediaPlaybackId);
        if (!cancelled) setPostId(id);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, initialPostId, mediaPlaybackId]);

  // Load post + comments for the current postId
  useEffect(() => {
    if (!postId) {
      setPost(null);
      setLoading(false);
      return;
    }
    let mounted = true;

    // Check cache first for instant navigation
    const cachedPost = getCachedPost(postId);
    if (cachedPost) {
      setPost(cachedPost);
      setLoading(false);
      onCommentCountChangeRef.current?.(cachedPost.id, cachedPost.comment_count);
      // Still fetch fresh data in background
    } else {
      // Keep showing previous post while loading (smoother transition)
      setLoading(true);
    }

    (async () => {
      try {
        const { data: postRow, error: postsError } = await supabase
          .from("event_posts")
          .select(
            "id, text, author_user_id, created_at, media_urls, like_count, comment_count, ticket_tier_id",
          )
          .eq("id", postId)
          .eq("event_id", eventId)
          .maybeSingle();

        if (postsError) throw postsError;
        if (!postRow) {
          if (mounted) setPost(null);
          return;
        }

        const [profileRes, tierRes, commentsRes] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("user_id, display_name, photo_url")
            .eq("user_id", postRow.author_user_id)
            .maybeSingle(),
          postRow.ticket_tier_id
            ? supabase
                .from("ticket_tiers")
                .select("id, badge_label")
                .eq("id", postRow.ticket_tier_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from("event_comments")
            .select(
              "id, text, author_user_id, created_at, post_id, is_pinned, parent_comment_id, mentions, reply_count",
            )
            .eq("post_id", postRow.id)
            .is("deleted_at", null)
            .order("is_pinned", { ascending: false })
            .order("created_at", { ascending: true }),
        ]);

        if (commentsRes.error) throw commentsRes.error;
        if (profileRes.error) throw profileRes.error;
        if (tierRes.error) throw tierRes.error;

        const authorProfile = profileRes.data;
        const tier = tierRes.data;

        const commentAuthorIds = [
          ...new Set((commentsRes.data ?? []).map((c: any) => c.author_user_id)),
        ];
        const commentIds = (commentsRes.data ?? []).map((c: any) => c.id);

        let commentProfiles: Record<string, any> = {};
        if (commentAuthorIds.length) {
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("user_id, display_name, photo_url")
            .in("user_id", commentAuthorIds);

          commentProfiles = (profiles ?? []).reduce(
            (acc: Record<string, any>, p: any) => {
              acc[p.user_id] = p;
              return acc;
            },
            {},
          );
        }

        // Load comment likes and user's like status
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        let commentLikes: Record<string, { count: number; is_liked: boolean }> = {};
        
        if (commentIds.length) {
          // Skip queries if we know the table doesn't exist
          if (tableExistenceCache.event_comment_reactions === false) {
            // Table doesn't exist - initialize with zeros
            commentIds.forEach((cid) => {
              commentLikes[cid] = { count: 0, is_liked: false };
            });
          } else {
            try {
              if (userId) {
                const [likesRes, userLikesRes] = await Promise.all([
                  supabase
                    .from("event_comment_reactions")
                    .select("comment_id")
                    .in("comment_id", commentIds)
                    .eq("kind", "like")
                    .limit(1000), // Prevent huge queries
                  supabase
                    .from("event_comment_reactions")
                    .select("comment_id")
                    .in("comment_id", commentIds)
                    .eq("user_id", userId)
                    .eq("kind", "like")
                    .limit(1000),
                ]);

                // Any error → assume table not available, stop querying
                if (likesRes.error || userLikesRes.error) {
                  tableExistenceCache.event_comment_reactions = false;
                  commentIds.forEach((cid) => {
                    commentLikes[cid] = { count: 0, is_liked: false };
                  });
                } else {
                  tableExistenceCache.event_comment_reactions = true;
                  const likedCommentIds = new Set(
                    (userLikesRes.data ?? []).map((r: any) => r.comment_id)
                  );

                  // Count likes per comment
                  const likesByComment: Record<string, number> = {};
                  (likesRes.data ?? []).forEach((r: any) => {
                    likesByComment[r.comment_id] = (likesByComment[r.comment_id] || 0) + 1;
                  });

                  commentIds.forEach((cid) => {
                    commentLikes[cid] = {
                      count: likesByComment[cid] || 0,
                      is_liked: likedCommentIds.has(cid),
                    };
                  });
                }
              } else {
                // If not logged in, just count likes
                const likesRes = await supabase
                  .from("event_comment_reactions")
                  .select("comment_id")
                  .in("comment_id", commentIds)
                  .eq("kind", "like")
                  .limit(1000);

                if (likesRes.error) {
                  tableExistenceCache.event_comment_reactions = false;
                  commentIds.forEach((cid) => {
                    commentLikes[cid] = { count: 0, is_liked: false };
                  });
                } else {
                  tableExistenceCache.event_comment_reactions = true;
                  const likesByComment: Record<string, number> = {};
                  (likesRes.data ?? []).forEach((r: any) => {
                    likesByComment[r.comment_id] = (likesByComment[r.comment_id] || 0) + 1;
                  });

                  commentIds.forEach((cid) => {
                    commentLikes[cid] = {
                      count: likesByComment[cid] || 0,
                      is_liked: false,
                    };
                  });
                }
              }
            } catch (e: any) {
              // Any error → assume table not available
              tableExistenceCache.event_comment_reactions = false;
              commentIds.forEach((cid) => {
                commentLikes[cid] = { count: 0, is_liked: false };
              });
            }
          }
        }

        // Build nested comments
        const rootComments: Comment[] = [];
        const byId: Record<string, Comment> = {};

        for (const c of (commentsRes.data ?? []) as any[]) {
          const likeData = commentLikes[c.id] || { count: 0, is_liked: false };
          const comment: Comment = {
            id: c.id,
            post_id: c.post_id,
            text: c.text,
            author_user_id: c.author_user_id,
            created_at: c.created_at,
            author_name:
              commentProfiles[c.author_user_id]?.display_name ?? "Anonymous",
            author_avatar:
              commentProfiles[c.author_user_id]?.photo_url ?? null,
            likes_count: likeData.count,
            is_liked: likeData.is_liked,
            is_pinned: c.is_pinned ?? false,
            parent_comment_id: c.parent_comment_id ?? null,
            mentions: c.mentions ?? [],
            reply_count: c.reply_count ?? 0,
            replies: [],
          };
          byId[comment.id] = comment;
        }

        for (const c of Object.values(byId)) {
          if (c.parent_comment_id && byId[c.parent_comment_id]) {
            const parent = byId[c.parent_comment_id];
            parent.replies = parent.replies || [];
            parent.replies.push(c);
          } else {
            rootComments.push(c);
          }
        }

        // Check if current user has liked the post
        let isLiked = false;
        if (userId) {
          // Skip query if we know the table doesn't exist
          if (tableExistenceCache.event_reactions === false) {
            isLiked = false;
          } else {
            try {
              const { data: userLike, error: likeError } = await supabase
                .from("event_reactions")
                .select("id")
                .eq("post_id", postRow.id)
                .eq("user_id", userId)
                .eq("kind", "like")
                .maybeSingle();
              
              // Any error → assume table not available
              if (likeError) {
                tableExistenceCache.event_reactions = false;
                isLiked = false;
              } else {
                tableExistenceCache.event_reactions = true;
                isLiked = !!userLike;
              }
            } catch (e: any) {
              // Any error → assume table not available
              tableExistenceCache.event_reactions = false;
              isLiked = false;
            }
          }
        }

        const mappedPost: Post = {
          id: postRow.id,
          text: postRow.text,
          author_user_id: postRow.author_user_id,
          created_at: postRow.created_at,
          media_urls: (postRow.media_urls ?? []).map(muxToHls),
          author_name: authorProfile?.display_name ?? "Anonymous",
          author_avatar: authorProfile?.photo_url ?? null,
          author_badge: tier?.badge_label ?? null,
          author_is_organizer: false,
          comments: rootComments,
          likes_count: postRow.like_count ?? 0,
          is_liked: isLiked,
          comment_count: postRow.comment_count ?? 0,
        };

        // Cache for instant navigation
        setCachedPost(mappedPost.id, mappedPost);

        if (mounted) {
          setPost(mappedPost);
          onCommentCountChangeRef.current?.(mappedPost.id, mappedPost.comment_count);
        }
      } catch (e: any) {
        console.error(e);
        if (mounted) {
          toast({
            title: "Error",
            description: e.message || "Failed to load comments",
            variant: "destructive",
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [eventId, postId]);

  // Realtime updates (same semantics as your existing hook)
  useRealtimeComments({
    postIds: postId ? [postId] : undefined,
    onCommentAdded: (incoming) => {
      setPost((prev) => {
        if (!prev || prev.id !== incoming.post_id) return prev;

        const newComment: Comment = {
          id: incoming.id,
          post_id: incoming.post_id,
          text: incoming.text,
          author_user_id: incoming.author_user_id,
          created_at: incoming.created_at,
          author_name: incoming.author_name ?? "Anonymous",
          author_avatar: null,
          likes_count: 0,
          is_liked: false,
          parent_comment_id: (incoming as any).parent_comment_id ?? null,
          is_pinned: (incoming as any).is_pinned ?? false,
          mentions: (incoming as any).mentions ?? [],
          reply_count: 0,
          replies: [],
        };

        const keyFor = (c: Comment) =>
          `${c.author_user_id}|${new Date(c.created_at)
            .toISOString()
            .slice(0, 19)}|${(c.text || "").slice(0, 64)}`;

        const updateTree = (comments: Comment[]): Comment[] => {
          const pendingIdx = comments.findIndex(
            (c) =>
              c.pending &&
              ((c.client_id &&
                (incoming as any).client_id &&
                c.client_id === (incoming as any).client_id) ||
                keyFor(c) === keyFor(incoming as any)),
          );

          let updated = comments;
          if (pendingIdx !== -1) {
            updated = comments.map((c, idx) =>
              idx === pendingIdx ? { ...newComment, pending: false } : c,
            );
            return updated;
          }

          if (newComment.parent_comment_id) {
            return comments.map((c) => {
              if (c.id === newComment.parent_comment_id) {
                return {
                  ...c,
                  replies: [...(c.replies || []), newComment],
                  reply_count: (c.reply_count || 0) + 1,
                };
              }
              if (c.replies && c.replies.length > 0) {
                return { ...c, replies: updateTree(c.replies) };
              }
              return c;
            });
          }

          return [...comments, newComment];
        };

        const nextComments = updateTree(prev.comments);
        const nextCount = prev.comment_count + 1;
        onCommentCountChangeRef.current?.(prev.id, nextCount);

        return {
          ...prev,
          comments: nextComments,
          comment_count: nextCount,
        };
      });
    },
    onCommentDeleted: (deleted) => {
      setPost((prev) => {
        if (!prev || prev.id !== deleted.post_id) return prev;

        const deleteRecursive = (comments: Comment[]): Comment[] =>
          comments
            .filter((c) => c.id !== deleted.id)
            .map((c) => {
              if (c.replies && c.replies.length > 0) {
                const newReplies = deleteRecursive(c.replies);
                const diff = c.replies.length - newReplies.length;
                return {
                  ...c,
                  replies: newReplies,
                  reply_count: Math.max(0, (c.reply_count || 0) - diff),
                };
              }
              return c;
            });

        const newComments = deleteRecursive(prev.comments);
        const topLevelRemoved = prev.comments.length - newComments.length;
        const nextCount = Math.max(0, prev.comment_count - topLevelRemoved);
        if (topLevelRemoved > 0) {
          onCommentCountChangeRef.current?.(prev.id, nextCount);
        }

        return {
          ...prev,
          comments: newComments,
          comment_count: nextCount,
        };
      });
    },
  });

  return { postId, setPostId, post, setPost, loading };
}

