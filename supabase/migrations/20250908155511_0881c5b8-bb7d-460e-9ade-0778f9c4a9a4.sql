-- Create RPC function for efficient top-K posts per event (only the RPC part)
CREATE OR REPLACE FUNCTION public.get_event_posts(p_event_ids uuid[], p_k int DEFAULT 3)
RETURNS TABLE (
  id uuid, 
  event_id uuid, 
  text text, 
  created_at timestamptz,
  media_urls text[], 
  like_count int, 
  comment_count int,
  author_user_id uuid, 
  author_display_name text, 
  author_is_organizer boolean,
  ticket_tier_id uuid
)
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
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
    author_display_name, author_is_organizer, ticket_tier_id
  FROM ranked
  WHERE rn <= p_k
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_event_posts(uuid[], int) TO anon, authenticated;