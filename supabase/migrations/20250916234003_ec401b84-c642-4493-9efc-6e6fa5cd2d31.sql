-- Add focused RPC to fetch a single post as a feed item
CREATE OR REPLACE FUNCTION public.get_feed_item_for_post(p_user uuid, p_post_id uuid)
RETURNS TABLE (
  item_type text,
  sort_ts timestamptz,
  item_id uuid,
  event_id uuid,
  event_title text,
  event_description text,
  event_starts_at timestamptz,
  event_cover_image text,
  event_organizer text,
  event_organizer_id uuid,
  event_location text,
  author_id uuid,
  author_name text,
  author_badge text,
  media_urls text[],
  content text,
  metrics jsonb
) LANGUAGE sql STABLE AS $$
  SELECT
    'post'::text,
    p.created_at,
    p.id,
    p.event_id,
    e.title,
    e.description,
    e.start_at,
    e.cover_image_url,
    eup.display_name,
    e.created_by,
    COALESCE(e.city, e.venue, 'TBA'),
    p.author_user_id,
    p.author_name,
    p.author_badge_label,
    p.media_urls,
    p.text,
    jsonb_build_object(
      'likes', COALESCE(p.like_count, 0),
      'comments', COALESCE(p.comment_count, 0)
    )
  FROM event_posts_with_meta p
  JOIN events e ON e.id = p.event_id
  JOIN user_profiles eup ON eup.user_id = e.created_by
  WHERE p.id = p_post_id
    AND p.deleted_at IS NULL
    AND can_view_event(p_user, p.event_id);
$$;