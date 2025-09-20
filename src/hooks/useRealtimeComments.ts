import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Comment {
  id: string;
  text: string;
  author_name: string;
  created_at: string;
  post_id: string;
  author_user_id: string;
}

interface UseRealtimeCommentsProps {
  eventId?: string;
  onCommentAdded: (comment: Comment) => void;
  onCommentDeleted: (commentId: string) => void;
}

export const useRealtimeComments = ({ eventId, onCommentAdded, onCommentDeleted }: UseRealtimeCommentsProps) => {
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase
      .channel(`comments-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_comments',
          filter: `post_id=in.(select id from event_posts where event_id=eq.${eventId})`
        },
        (payload) => {
          const newComment = payload.new as Comment;
          onCommentAdded(newComment);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'event_comments',
          filter: `post_id=in.(select id from event_posts where event_id=eq.${eventId})`
        },
        (payload) => {
          const deletedComment = payload.old as Comment;
          onCommentDeleted(deletedComment.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, onCommentAdded, onCommentDeleted]);
};