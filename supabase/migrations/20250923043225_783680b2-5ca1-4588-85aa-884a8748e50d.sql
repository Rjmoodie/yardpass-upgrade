-- Fix search path for get_home_feed_v2 function to address security warning
CREATE OR REPLACE FUNCTION get_home_feed_v2(
  p_user uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_cursor_ts timestamptz DEFAULT NULL,
  p_cursor_id text DEFAULT NULL
)
RETURNS TABLE (
  item_type text,
  sort_ts timestamptz,
  item_id text,
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
  author_social_links jsonb,
  media_urls text[],
  content text,
  metrics jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH events_stream AS (
    SELECT
      'event'::text AS item_type,
      e.created_at AS sort_ts,
      e.id::text AS item_id,
      e.id AS event_id,
      e.title AS event_title,
      e.description AS event_description,
      e.start_at AS event_starts_at,
      e.cover_image_url AS event_cover_image,
      CASE 
        WHEN e.owner_context_type = 'organization' THEN org.name
        ELSE up.display_name
      END AS event_organizer,
      e.owner_context_id AS event_organizer_id,
      COALESCE(e.city, e.venue, 'TBA') AS event_location,
      NULL::uuid AS author_id,
      NULL::text AS author_name,
      NULL::text AS author_badge,
      NULL::jsonb AS author_social_links,
      NULL::text[] AS media_urls,
      NULL::text AS content,
      jsonb_build_object(
        'visibility', e.visibility,
        'attendee_count', 0
      ) AS metrics
    FROM events e
    LEFT JOIN user_profiles up ON up.user_id = e.owner_context_id AND e.owner_context_type = 'individual'
    LEFT JOIN organizations org ON org.id = e.owner_context_id AND e.owner_context_type = 'organization'
    WHERE (p_user IS NULL AND e.visibility = 'public') 
       OR (p_user IS NOT NULL AND can_view_event(p_user, e.id))
  ),
  posts_stream AS (
    SELECT
      'post'::text AS item_type,
      p.created_at AS sort_ts,
      p.id::text AS item_id,
      p.event_id,
      e.title AS event_title,
      e.description AS event_description,
      e.start_at AS event_starts_at,
      e.cover_image_url AS event_cover_image,
      CASE 
        WHEN e.owner_context_type = 'organization' THEN org.name
        ELSE eup.display_name
      END AS event_organizer,
      e.owner_context_id AS event_organizer_id,
      COALESCE(e.city, e.venue, 'TBA') AS event_location,
      p.author_user_id AS author_id,
      ap.display_name AS author_name,
      CASE 
        WHEN p.author_user_id = e.created_by THEN 'ORGANIZER'
        ELSE COALESCE(get_user_highest_tier_badge(p.author_user_id, e.id), 'ATTENDEE')
      END AS author_badge,
      COALESCE(ap.social_links, '[]'::jsonb) AS author_social_links,
      p.media_urls,
      p.text AS content,
      jsonb_build_object(
        'likes', COALESCE(p.like_count, 0),
        'comments', COALESCE(p.comment_count, 0),
        'viewer_has_liked', CASE 
          WHEN p_user IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM event_reactions r 
            WHERE r.post_id = p.id 
              AND r.user_id = p_user 
              AND r.kind = 'like'
          )
        END
      ) AS metrics
    FROM event_posts p
    JOIN events e ON e.id = p.event_id
    LEFT JOIN user_profiles eup ON eup.user_id = e.owner_context_id AND e.owner_context_type = 'individual'
    LEFT JOIN organizations org ON org.id = e.owner_context_id AND e.owner_context_type = 'organization'
    LEFT JOIN user_profiles ap ON ap.user_id = p.author_user_id
    WHERE p.deleted_at IS NULL
      AND ((p_user IS NULL AND e.visibility = 'public') 
           OR (p_user IS NOT NULL AND can_view_event(p_user, p.event_id)))
  ),
  unioned AS (
    SELECT * FROM events_stream
    UNION ALL
    SELECT * FROM posts_stream
  ),
  filtered AS (
    SELECT *
    FROM unioned u
    WHERE
      CASE
        WHEN p_cursor_ts IS NULL THEN TRUE
        WHEN p_cursor_id IS NULL THEN u.sort_ts < p_cursor_ts
        ELSE (u.sort_ts, u.item_id) < (p_cursor_ts, p_cursor_id)
      END
  )
  SELECT *
  FROM filtered
  ORDER BY sort_ts DESC, item_id DESC
  LIMIT p_limit;
END;
$$;