// src/components/post-viewer/useEventPostsBatch.ts
// Hook to load multiple posts for a single event in one batch
// Much faster than loading one at a time during navigation

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { muxToHls } from "@/utils/media";
import type { ViewerPost } from "./types";

type BatchLoadResult = {
  posts: ViewerPost[];
  loading: boolean;
  error: string | null;
};

export function useEventPostsBatch(
  eventId: string,
  postIds: string[],
  enabled = true
): BatchLoadResult {
  const [posts, setPosts] = useState<ViewerPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track what we've already loaded to avoid refetching
  const loadedIdsRef = useRef<Set<string>>(new Set());
  const eventIdRef = useRef(eventId);

  useEffect(() => {
    if (!enabled || !eventId || !postIds.length) {
      setPosts([]);
      setLoading(false);
      return;
    }

    // Reset if event changed
    if (eventIdRef.current !== eventId) {
      loadedIdsRef.current.clear();
      setPosts([]);
      eventIdRef.current = eventId;
    }

    // Find which posts we need to load
    const idsToLoad = postIds.filter((id) => !loadedIdsRef.current.has(id));
    
    // If all posts are already loaded, just reorder
    if (idsToLoad.length === 0) {
      setPosts((prev) => {
        const byId = new Map(prev.map((p) => [p.id, p]));
        return postIds.map((id) => byId.get(id)).filter(Boolean) as ViewerPost[];
      });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 1. Fetch all posts in one query
        const { data: postRows, error: postsError } = await supabase
          .from("event_posts")
          .select("id, text, author_user_id, created_at, media_urls, like_count, comment_count, ticket_tier_id")
          .eq("event_id", eventId)
          .in("id", idsToLoad)
          .is("deleted_at", null);

        if (postsError) throw postsError;
        if (!postRows?.length) {
          if (cancelled) return;
          setLoading(false);
          return;
        }

        // 2. Get unique author IDs and tier IDs
        const authorIds = [...new Set(postRows.map((p) => p.author_user_id))];
        const tierIds = [...new Set(postRows.map((p) => p.ticket_tier_id).filter(Boolean))] as string[];

        // 3. Batch fetch profiles and tiers
        const [profilesRes, tiersRes, userRes] = await Promise.all([
          supabase
            .from("user_profiles")
            .select("user_id, display_name, photo_url")
            .in("user_id", authorIds),
          tierIds.length > 0
            ? supabase.from("ticket_tiers").select("id, badge_label").in("id", tierIds)
            : Promise.resolve({ data: [], error: null }),
          supabase.auth.getUser(),
        ]);

        if (cancelled) return;

        // Build lookup maps
        const profileMap = new Map(
          (profilesRes.data ?? []).map((p) => [p.user_id, p])
        );
        const tierMap = new Map(
          (tiersRes.data ?? []).map((t) => [t.id, t])
        );
        const currentUserId = userRes.data?.user?.id;

        // 4. Check which posts the user has liked (batch)
        let likedPostIds = new Set<string>();
        if (currentUserId) {
          const { data: likes } = await supabase
            .from("event_reactions")
            .select("post_id")
            .eq("user_id", currentUserId)
            .eq("kind", "like")
            .in("post_id", idsToLoad);
          
          if (!cancelled && likes) {
            likedPostIds = new Set(likes.map((l) => l.post_id));
          }
        }

        if (cancelled) return;

        // 5. Build ViewerPost objects
        const newPosts: ViewerPost[] = postRows.map((row) => {
          const profile = profileMap.get(row.author_user_id);
          const tier = row.ticket_tier_id ? tierMap.get(row.ticket_tier_id) : null;

          return {
            id: row.id,
            text: row.text,
            author_user_id: row.author_user_id,
            created_at: row.created_at,
            media_urls: (row.media_urls ?? []).map(muxToHls),
            author_name: profile?.display_name ?? "Anonymous",
            author_avatar: profile?.photo_url ?? null,
            author_badge: tier?.badge_label ?? null,
            author_is_organizer: false,
            comments: [],
            likes_count: row.like_count ?? 0,
            is_liked: likedPostIds.has(row.id),
            comment_count: row.comment_count ?? 0,
            event_id: eventId,
          };
        });

        // Mark as loaded
        newPosts.forEach((p) => loadedIdsRef.current.add(p.id));

        // Merge with existing and reorder to match postIds
        setPosts((prev) => {
          const byId = new Map([...prev, ...newPosts].map((p) => [p.id, p]));
          return postIds.map((id) => byId.get(id)).filter(Boolean) as ViewerPost[];
        });
      } catch (e: any) {
        console.error("[useEventPostsBatch] Error:", e);
        if (!cancelled) {
          setError(e.message || "Failed to load posts");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, postIds.join(","), enabled]);

  return { posts, loading, error };
}


