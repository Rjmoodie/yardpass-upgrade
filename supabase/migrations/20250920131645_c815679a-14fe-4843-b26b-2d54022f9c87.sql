-- Replace the old function with a unified, view-less search over events and posts
CREATE OR REPLACE FUNCTION public.search_all(
  p_user uuid DEFAULT NULL,
  p_q text DEFAULT '',
  p_category text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_only_events boolean DEFAULT false,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  item_type text,                        -- 'event' | 'post'
  item_id uuid,                          -- events.id or event_posts.id
  parent_event_id uuid,                  -- NULL for events, events.id for posts
  title text,
  description text,
  content text,
  category text,
  created_at timestamptz,
  cover_image_url text,
  organizer_name text,
  location text,
  start_at timestamptz,
  visibility text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
WITH
-- Normalized text query
q AS (
  SELECT NULLIF(TRIM(p_q), '') AS qtext
),

-- Events candidate set (discovery: public; include private if caller can view; exclude unlisted)
events_base AS (
  SELECT
    'event'::text AS item_type,
    e.id AS item_id,
    NULL::uuid AS parent_event_id,
    e.title,
    e.description,
    e.description AS content,
    e.category,
    e.created_at,
    e.cover_image_url,
    COALESCE(org.name, up.display_name) AS organizer_name,
    NULLIF(TRIM(CONCAT_WS(', ', e.venue, e.city, e.country)), '') AS location,
    e.start_at,
    e.visibility::text AS visibility,
    -- Full-text vector for ranking
    to_tsvector('simple',
      COALESCE(e.title,'') || ' ' ||
      COALESCE(e.description,'') || ' ' ||
      COALESCE(e.category,'') || ' ' ||
      COALESCE(org.name,'') || ' ' ||
      COALESCE(up.display_name,'')
    ) AS tsv
  FROM events e
  LEFT JOIN organizations org
    ON e.owner_context_type = 'organization'
   AND e.owner_context_id = org.id
  LEFT JOIN user_profiles up
    ON up.user_id = e.created_by
  WHERE
    -- Visibility: discover public; include private if user can view; exclude unlisted from search
    (
      e.visibility = 'public'
      OR (
        p_user IS NOT NULL
        AND e.visibility = 'private'
        AND can_view_event(p_user, e.id)
      )
    )
    -- Filters
    AND (p_category IS NULL OR e.category = p_category)
    AND (p_date_from IS NULL OR e.start_at >= (p_date_from::date)::timestamptz)
    AND (p_date_to   IS NULL OR e.start_at <  ((p_date_to::date + 1))::timestamptz)  -- inclusive date_to
),

-- Posts candidate set (bound to their event; inherits event filters/visibility)
posts_base AS (
  SELECT
    'post'::text AS item_type,
    p.id AS item_id,
    p.event_id AS parent_event_id,
    -- Title is synthesized from post and event
    COALESCE(NULLIF(TRIM(SUBSTRING(p.text FROM 1 FOR 80)), ''), e.title, 'Post') AS title,
    -- Short description from post text
    SUBSTRING(p.text FROM 1 FOR 280) AS description,
    p.text AS content,
    e.category,
    p.created_at,
    e.cover_image_url,
    COALESCE(pa.display_name, org.name, eu.display_name) AS organizer_name,
    NULLIF(TRIM(CONCAT_WS(', ', e.venue, e.city, e.country)), '') AS location,
    e.start_at,
    e.visibility::text AS visibility,
    to_tsvector('simple',
      COALESCE(p.text,'') || ' ' ||
      COALESCE(e.title,'') || ' ' ||
      COALESCE(e.category,'') || ' ' ||
      COALESCE(org.name,'') || ' ' ||
      COALESCE(eu.display_name,'') || ' ' ||
      COALESCE(pa.display_name,'')
    ) AS tsv
  FROM event_posts p
  JOIN events e
    ON e.id = p.event_id
  LEFT JOIN organizations org
    ON e.owner_context_type = 'organization'
   AND e.owner_context_id = org.id
  LEFT JOIN user_profiles eu                -- event creator profile
    ON eu.user_id = e.created_by
  LEFT JOIN user_profiles pa                -- post author profile
    ON pa.user_id = p.author_user_id
  WHERE
    -- Respect event visibility rules for discovery
    (
      e.visibility = 'public'
      OR (
        p_user IS NOT NULL
        AND e.visibility = 'private'
        AND can_view_event(p_user, e.id)
      )
    )
    -- Same filters as events (category/date are taken from the event)
    AND (p_category IS NULL OR e.category = p_category)
    AND (p_date_from IS NULL OR e.start_at >= (p_date_from::date)::timestamptz)
    AND (p_date_to   IS NULL OR e.start_at <  ((p_date_to::date + 1))::timestamptz)
    AND p.deleted_at IS NULL  -- Exclude deleted posts
),

-- Union depending on p_only_events
unioned AS (
  SELECT * FROM events_base
  UNION ALL
  SELECT * FROM posts_base
  WHERE NOT p_only_events
),

-- Rank if q provided
ranked AS (
  SELECT
    u.*,
    CASE
      WHEN (SELECT qtext FROM q) IS NULL OR (SELECT qtext FROM q) = '' THEN NULL::float
      ELSE ts_rank(u.tsv, plainto_tsquery('simple', (SELECT qtext FROM q)))
    END AS rank
  FROM unioned u
  WHERE
    -- Text filter: if query is provided, match via full-text OR ILIKE fallback
    (
      (SELECT qtext FROM q) IS NULL OR (SELECT qtext FROM q) = ''
    )
    OR (
      u.tsv @@ plainto_tsquery('simple', (SELECT qtext FROM q))
      OR u.title ILIKE '%' || (SELECT qtext FROM q) || '%'
      OR u.description ILIKE '%' || (SELECT qtext FROM q) || '%'
      OR u.content ILIKE '%' || (SELECT qtext FROM q) || '%'
      OR COALESCE(u.organizer_name,'') ILIKE '%' || (SELECT qtext FROM q) || '%'
      OR COALESCE(u.location,'') ILIKE '%' || (SELECT qtext FROM q) || '%'
    )
)

SELECT
  item_type,
  item_id,
  parent_event_id,
  title,
  description,
  content,
  category,
  created_at,
  cover_image_url,
  organizer_name,
  location,
  start_at,
  visibility
FROM ranked
ORDER BY
  -- If a query was provided, sort by rank first (desc), then recency
  CASE WHEN (SELECT qtext FROM q) IS NULL OR (SELECT qtext FROM q) = '' THEN 1 ELSE 0 END,
  created_at DESC,
  rank DESC NULLS LAST
LIMIT p_limit
OFFSET p_offset;
$function$;