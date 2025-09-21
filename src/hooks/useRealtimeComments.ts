// src/hooks/useRealtimeComments.ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Comment {
  id: string;
  text: string;
  author_name?: string;
  created_at: string;
  post_id: string;
  author_user_id: string;
}

interface UseRealtimeCommentsProps {
  eventId?: string;
  onCommentAdded: (comment: Comment) => void;
  onCommentDeleted: (comment: Comment) => void;
}

/**
 * Realtime comments for a given event:
 * - Loads all post IDs for the event
 * - Subscribes to INSERT/DELETE on event_comments with an IN(...) filter on post_id
 * - Also listens to event_posts inserts/deletes for this event to refresh the subscriptions
 * - Enriches author_name from user_profiles (cached) if missing
 */
export const useRealtimeComments = ({
  eventId,
  onCommentAdded,
  onCommentDeleted,
}: UseRealtimeCommentsProps) => {
  const [postIds, setPostIds] = useState<string[]>([]);
  const authorCacheRef = useRef<Map<string, { display_name?: string }>>(new Map());

  // Keep stable refs to callbacks
  const addedRef = useRef(onCommentAdded);
  const deletedRef = useRef(onCommentDeleted);
  useEffect(() => { addedRef.current = onCommentAdded; }, [onCommentAdded]);
  useEffect(() => { deletedRef.current = onCommentDeleted; }, [onCommentDeleted]);

  // Load current post IDs for the event
  useEffect(() => {
    if (!eventId) {
      setPostIds([]);
      return;
    }
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
  }, [eventId]);

  // Subscribe to post set changes (so we can refresh comment subscriptions)
  useEffect(() => {
    if (!eventId) return;

    const postsChannel = supabase
      .channel(`event-posts-${eventId}`, { config: { broadcast: { ack: true } } })
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

    return () => {
      supabase.removeChannel(postsChannel);
    };
  }, [eventId]);

  // Subscribe to comments for the current post IDs (chunked to avoid long IN lists)
  useEffect(() => {
    if (!eventId) return;
    // No posts yet -> no comment subscriptions
    if (postIds.length === 0) return;

    // Supabase IN(...) filters are fine with a bunch of values; we chunk for safety.
    const CHUNK = 100;
    const chunks: string[][] = [];
    for (let i = 0; i < postIds.length; i += CHUNK) {
      chunks.push(postIds.slice(i, i + CHUNK));
    }

    const commentChannels = chunks.map((ids, idx) => {
      const filter = `post_id=in.(${ids.join(',')})`;
      return supabase
        .channel(`event-comments-${eventId}-${idx}`, { config: { broadcast: { ack: true } } })
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'event_comments', filter },
          async (payload) => {
            const newComment = payload.new as Comment;
            // Enrich author name if missing (cached)
            if (!newComment.author_name && newComment.author_user_id) {
              const cached = authorCacheRef.current.get(newComment.author_user_id);
              if (cached) {
                addedRef.current({
                  ...newComment,
                  author_name: cached.display_name || 'User',
                });
                return;
              }
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('display_name')
                .eq('user_id', newComment.author_user_id)
                .single();
              authorCacheRef.current.set(newComment.author_user_id, {
                display_name: profile?.display_name,
              });
              addedRef.current({
                ...newComment,
                author_name: profile?.display_name || 'User',
              });
              return;
            }
            addedRef.current(newComment);
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'event_comments', filter },
          (payload) => {
            const deletedComment = payload.old as Comment;
            deletedRef.current(deletedComment);
          }
        )
        .subscribe();
    });

    // Cleanup when postIds change or eventId changes
    return () => {
      commentChannels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [eventId, postIds.join('|')]); // join for stable dependency

  // Optional: clear author cache on event change to avoid unbounded growth
  useEffect(() => {
    authorCacheRef.current.clear();
  }, [eventId]);
};
