// src/features/comments/hooks/useRealtimeComments.ts
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Comment } from '@/domain/posts';

/**
 * Realtime comment data - may have partial data compared to full Comment type
 * Extends domain Comment type with required fields for real-time updates
 */
export type RealtimeComment = Partial<Comment> & Pick<Comment, 'id' | 'text' | 'created_at' | 'post_id' | 'author_user_id'>;

/**
 * Props for useRealtimeComments hook
 */
interface UseRealtimeCommentsProps {
  /** Subscribe to comments for all posts in this event (alternative to postIds) */
  eventId?: string;
  /** Explicit list of post IDs to subscribe to (preferred when available) */
  postIds?: string[];
  /** Callback fired when a new comment is added */
  onCommentAdded: (comment: RealtimeComment) => void;
  /** Callback fired when a comment is deleted */
  onCommentDeleted: (comment: RealtimeComment) => void;
}

/**
 * Quotes each UUID for use in PostgREST `in.(...)` filter syntax
 * 
 * PostgREST requires UUIDs in `in.(...)` filters to be quoted strings
 * @param ids - Array of UUID strings
 * @returns Comma-separated quoted UUID string
 * 
 * @example
 * quoteCSV(['uuid1', 'uuid2']) // Returns: '"uuid1","uuid2"'
 */
const quoteCSV = (ids: string[]) =>
  ids.map((id) => `"${id}"`).join(',');

/**
 * Hook for real-time comment synchronization using Supabase Realtime.
 * 
 * Subscribes to comment INSERT/DELETE events for posts, either by event ID
 * or explicit post IDs. Automatically fetches and enriches author names.
 * 
 * **Performance Optimizations:**
 * - Uses refs for callbacks to prevent subscription churn
 * - Chunks post IDs (80 per subscription) to avoid query limits
 * - Caches author names locally to reduce database queries
 * - Automatically subscribes to new posts added to the event
 * 
 * **Subscription Pattern:**
 * - If `eventId` is provided: Subscribes to all posts in that event
 * - If `postIds` is provided: Subscribes only to those specific posts
 * - Post IDs are chunked into groups of 80 for efficient filtering
 * 
 * @param props - Configuration for comment subscriptions
 * 
 * @example
 * ```typescript
 * // Subscribe to all comments in an event
 * useRealtimeComments({
 *   eventId: 'event-uuid',
 *   onCommentAdded: (comment) => {
 *     console.log('New comment:', comment);
 *     // Update UI
 *   },
 *   onCommentDeleted: (comment) => {
 *     console.log('Deleted comment:', comment.id);
 *     // Remove from UI
 *   }
 * });
 * 
 * // Subscribe to specific posts
 * useRealtimeComments({
 *   postIds: ['post-1', 'post-2'],
 *   onCommentAdded: handleNewComment,
 *   onCommentDeleted: handleDeletedComment
 * });
 * ```
 */
export const useRealtimeComments = ({
  eventId,
  postIds: explicitPostIds,
  onCommentAdded,
  onCommentDeleted,
}: UseRealtimeCommentsProps) => {
  const [postIds, setPostIds] = useState<string[]>(explicitPostIds ?? []);
  const authorCacheRef = useRef<Map<string, { display_name?: string }>>(new Map());

  // 🎯 PERF-003: Keep latest callbacks in refs (prevent subscription churn)
  // Use useLayoutEffect to update refs synchronously before effects run
  const addedRef = useRef(onCommentAdded);
  const deletedRef = useRef(onCommentDeleted);
  
  React.useLayoutEffect(() => {
    addedRef.current = onCommentAdded;
  });
  
  React.useLayoutEffect(() => {
    deletedRef.current = onCommentDeleted;
  });

  // If caller supplies postIds, use them directly
  useEffect(() => {
    if (explicitPostIds && explicitPostIds.length) {
      setPostIds(explicitPostIds);
    } else if (!eventId) {
      setPostIds([]);
    }
  }, [explicitPostIds?.join('|'), eventId]);

  // If no explicit postIds, hydrate from event
  useEffect(() => {
    if (!eventId || (explicitPostIds && explicitPostIds.length)) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('event_posts')
        .select('id')
        .eq('event_id', eventId)
        .is('deleted_at', null);

      if (!cancelled) {
        if (error) {
          console.warn('Failed to load post IDs for event:', error);
          setPostIds([]);
        } else {
          setPostIds((data ?? []).map((r) => r.id));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, explicitPostIds?.length]);

  // Keep post set in sync when subscribing by event
  useEffect(() => {
    if (!eventId || (explicitPostIds && explicitPostIds.length)) return;

    const postsChannel = supabase
      .channel(`event-posts-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_posts', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const id = (payload.new as { id: string; deleted_at: string | null }).id;
          const deleted_at = (payload.new as any).deleted_at ?? null;
          if (!deleted_at) {
            setPostIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'event_posts', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setPostIds((prev) => prev.filter((p) => p !== id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(postsChannel); };
  }, [eventId, explicitPostIds?.length]);

  // Subscribe to comments for the current post IDs (chunked & **quoted**)
  useEffect(() => {
    if (postIds.length === 0) return;

    const CHUNK = 80; // keep it comfy
    const chunks: string[][] = [];
    for (let i = 0; i < postIds.length; i += CHUNK) chunks.push(postIds.slice(i, i + CHUNK));

    const commentChannels = chunks.map((ids, idx) => {
      // Proper quoting and encoding
      const filter = `post_id=in.(${quoteCSV(ids)})`;

      return supabase
        .channel(`event-comments-${(eventId ?? 'noevent')}-${idx}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'event_comments', filter },
          async (payload) => {
            const newComment = payload.new as RealtimeComment;

            // Enrich author name (simple local cache)
            if (!newComment.author_name && newComment.author_user_id) {
              const cached = authorCacheRef.current.get(newComment.author_user_id);
              if (cached) {
                addedRef.current({ ...newComment, author_name: cached.display_name || 'User' });
                return;
              }
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('display_name')
                .eq('user_id', newComment.author_user_id)
                .maybeSingle();

              const display_name = profile?.display_name;
              authorCacheRef.current.set(newComment.author_user_id, { display_name });
              addedRef.current({ ...newComment, author_name: display_name || 'User' });
              return;
            }

            addedRef.current(newComment);
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'event_comments', filter },
          (payload) => {
            const deletedComment = payload.old as RealtimeComment;
            deletedRef.current(deletedComment);
          }
        )
        .subscribe();
    });

    return () => { commentChannels.forEach((ch) => supabase.removeChannel(ch)); };
  }, [eventId, postIds.join('|')]);

  // keep cache bounded per event
  useEffect(() => { authorCacheRef.current.clear(); }, [eventId, explicitPostIds?.join('|')]);
};
