-- Drop and recreate the get_event_posts function to include ticket badges
DROP FUNCTION IF EXISTS public.get_event_posts(uuid[], integer);

CREATE OR REPLACE FUNCTION public.get_event_posts(p_event_ids uuid[], p_k integer DEFAULT 3)
 RETURNS TABLE(id uuid, event_id uuid, text text, created_at timestamp with time zone, media_urls text[], like_count integer, comment_count integer, author_user_id uuid, author_display_name text, author_is_organizer boolean, ticket_tier_id uuid, author_badge_label text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ranked AS (
    SELECT 
      p.id,
      p.event_id,
      p.text,
      p.created_at,
      p.media_urls,
      p.like_count,
      p.comment_count,
      p.author_user_id,
      up.display_name as author_display_name,
      (p.author_user_id = e.created_by) as author_is_organizer,
      p.ticket_tier_id,
      -- Get the user's highest tier badge for this event (for attendees)
      CASE 
        WHEN p.author_user_id = e.created_by THEN 'ORGANIZER'
        ELSE COALESCE(get_user_event_badge(p.author_user_id, p.event_id), 'ATTENDEE')
      END as author_badge_label,
      ROW_NUMBER() OVER (PARTITION BY p.event_id ORDER BY p.created_at DESC) as rn
    FROM event_posts p
    JOIN events e ON e.id = p.event_id
    LEFT JOIN user_profiles up ON up.user_id = p.author_user_id
    WHERE p.event_id = ANY(p_event_ids)
      AND p.deleted_at IS NULL
      AND e.visibility = 'public'
  )
  SELECT 
    id, event_id, text, created_at, media_urls, 
    like_count, comment_count, author_user_id, 
    author_display_name, author_is_organizer, ticket_tier_id, author_badge_label
  FROM ranked
  WHERE rn <= p_k
$function$