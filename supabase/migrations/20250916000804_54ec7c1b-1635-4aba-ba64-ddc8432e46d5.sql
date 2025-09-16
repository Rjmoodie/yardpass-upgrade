-- Create a discriminated union feed function that prevents post overrides
CREATE OR REPLACE FUNCTION can_view_event(p_user uuid, p_event uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM events e
    LEFT JOIN tickets t ON t.event_id = e.id AND t.owner_user_id = p_user AND t.status IN ('issued', 'transferred', 'redeemed')
    LEFT JOIN org_memberships m ON m.org_id = e.owner_context_id
                                AND e.owner_context_type = 'organization'
                                AND m.user_id = p_user
    WHERE e.id = p_event
      AND (
        e.visibility = 'public'
        OR e.created_by = p_user
        OR t.id IS NOT NULL
        OR m.id IS NOT NULL
      )
  );
$$;

-- Create unified feed function that returns events and posts separately
CREATE OR REPLACE FUNCTION get_home_feed_v2(
  p_user uuid DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_cursor_ts timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
)
RETURNS TABLE (
  item_type text,                -- 'event' | 'post'
  sort_ts timestamptz,           -- drives ordering + cursor
  item_id uuid,                  -- event.id or post.id
  event_id uuid,
  event_title text,
  event_description text,
  event_starts_at timestamptz,
  event_cover_image text,
  event_organizer text,
  event_organizer_id uuid,
  event_location text,
  author_id uuid,                -- null for item_type='event'
  author_name text,              -- null for event
  author_badge text,             -- 'ORGANIZER' | 'ATTENDEE' | 'VIP' | null
  media_urls text[],             -- null for event
  content text,                  -- null for event
  metrics jsonb                  -- freeform counters per type
) LANGUAGE sql STABLE AS $$
  WITH latest_post_per_event AS (
    SELECT
      p.event_id,
      MAX(p.created_at) AS last_post_at
    FROM event_posts p
    WHERE p.deleted_at IS NULL
    GROUP BY 1
  ),
  events_stream AS (
    SELECT
      'event'::text AS item_type,
      GREATEST(COALESCE(l.last_post_at, e.created_at), e.created_at) AS sort_ts,
      e.id AS item_id,
      e.id AS event_id,
      e.title AS event_title,
      e.description AS event_description,
      e.start_at AS event_starts_at,
      e.cover_image_url AS event_cover_image,
      up.display_name AS event_organizer,
      e.created_by AS event_organizer_id,
      COALESCE(e.city, e.venue, 'TBA') AS event_location,
      NULL::uuid AS author_id,
      NULL::text AS author_name,
      NULL::text AS author_badge,
      NULL::text[] AS media_urls,
      NULL::text AS content,
      jsonb_build_object(
        'visibility', e.visibility,
        'attendee_count', 0
      ) AS metrics
    FROM events e
    JOIN user_profiles up ON up.user_id = e.created_by
    LEFT JOIN latest_post_per_event l ON l.event_id = e.id
    WHERE (p_user IS NULL AND e.visibility = 'public') 
       OR (p_user IS NOT NULL AND can_view_event(p_user, e.id))
  ),
  posts_stream AS (
    SELECT
      'post'::text AS item_type,
      p.created_at AS sort_ts,
      p.id AS item_id,
      p.event_id,
      e.title AS event_title,
      e.description AS event_description,
      e.start_at AS event_starts_at,
      e.cover_image_url AS event_cover_image,
      eup.display_name AS event_organizer,
      e.created_by AS event_organizer_id,
      COALESCE(e.city, e.venue, 'TBA') AS event_location,
      p.author_user_id AS author_id,
      ap.display_name AS author_name,
      CASE 
        WHEN p.author_user_id = e.created_by THEN 'ORGANIZER'
        ELSE COALESCE(get_user_highest_tier_badge(p.author_user_id, e.id), 'ATTENDEE')
      END AS author_badge,
      p.media_urls,
      p.text AS content,
      jsonb_build_object(
        'likes', COALESCE(p.like_count, 0),
        'comments', COALESCE(p.comment_count, 0)
      ) AS metrics
    FROM event_posts p
    JOIN events e ON e.id = p.event_id
    JOIN user_profiles eup ON eup.user_id = e.created_by
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
$$;

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_event_posts_event_created ON event_posts(event_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);