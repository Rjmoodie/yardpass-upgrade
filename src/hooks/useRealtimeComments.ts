// src/hooks/useRealtimeComments.ts
import { useEffect, useRef, useState } from 'react';
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
  /** Subscribe by event OR explicit postIds (prefer postIds when you can) */
  eventId?: string;
  postIds?: string[];
  onCommentAdded: (comment: Comment) => void;
  onCommentDeleted: (comment: Comment) => void;
}

/** Quote each UUID for PostgREST `in.(...)` filter */
const quoteCSV = (ids: string[]) =>
  ids.map((id) => `"${id}"`).join(',');

export const useRealtimeComments = ({
  eventId,
  postIds: explicitPostIds,
  onCommentAdded,
  onCommentDeleted,
}: UseRealtimeCommentsProps) => {
  const [postIds, setPostIds] = useState<string[]>(explicitPostIds ?? []);
  const authorCacheRef = useRef<Map<string, { display_name?: string }>>(new Map());

  // Keep latest callbacks
  const addedRef = useRef(onCommentAdded);
  const deletedRef = useRef(onCommentDeleted);
  useEffect(() => { 
    console.log('🔥 useRealtimeComments: Updating onCommentAdded callback');
    addedRef.current = onCommentAdded; 
  }, [onCommentAdded]);
  useEffect(() => { 
    console.log('🔥 useRealtimeComments: Updating onCommentDeleted callback');
    deletedRef.current = onCommentDeleted; 
  }, [onCommentDeleted]);

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
            const newComment = payload.new as Comment;

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
            const deletedComment = payload.old as Comment;
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
