import { useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

type OnInsert = (payload: {
  event_id: string;
  id: string;
  text: string | null;
  media_urls: string[] | null;
  author_user_id: string;
  created_at: string;
  like_count: number;
  comment_count: number;
}) => void;

export function useRealtimePosts(eventIds: string[], onInsert: OnInsert) {
  const filter = useMemo(() => {
    if (!eventIds || eventIds.length === 0) return null;
    // Quote UUIDs for filter syntax: in.("uuid1","uuid2")
    const csv = eventIds.map((id) => `"${id}"`).join(',');
    return `event_id=in.(${csv})`;
  }, [eventIds]);

  useEffect(() => {
    if (!filter) return;

    const channel = supabase
      .channel('realtime:home_feed_posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_posts', filter },
        (payload) => {
          const r: any = payload.new;
          onInsert({
            event_id: r.event_id,
            id: r.id,
            text: r.text ?? null,
            media_urls: r.media_urls ?? null,
            author_user_id: r.author_user_id,
            created_at: r.created_at,
            like_count: r.like_count ?? 0,
            comment_count: r.comment_count ?? 0,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter, onInsert]);
}
