-- Fix sponsor labeling with correct statuses, aggregation, and performance

-- Drop the old function first
DROP FUNCTION IF EXISTS public.get_active_event_sponsors(uuid[]);

-- Active sponsors = accepted, live, or completed (funded sponsorships) AND package active
CREATE OR REPLACE FUNCTION public.get_active_event_sponsors(p_event_ids uuid[])
RETURNS TABLE(
  event_id uuid,
  primary_sponsor jsonb,     -- top sponsor (by amount, then oldest)
  sponsors jsonb             -- all sponsors as array [{name,logo_url,tier,amount_cents}]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH base AS (
    SELECT
      so.event_id,
      s.name,
      s.logo_url,
      sp.tier,
      so.amount_cents,
      so.created_at
    FROM public.sponsorship_orders so
    JOIN public.sponsors s         ON s.id = so.sponsor_id
    JOIN public.sponsorship_packages sp ON sp.id = so.package_id
    WHERE so.event_id = ANY(p_event_ids)
      AND so.status IN ('accepted','live','completed')
      AND sp.is_active = true
  ),
  ranked AS (
    SELECT
      event_id,
      jsonb_build_object(
        'name', name,
        'logo_url', logo_url,
        'tier', tier,
        'amount_cents', amount_cents
      ) AS sponsor_obj,
      ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY amount_cents DESC, created_at ASC) AS rn
    FROM base
  ),
  agg AS (
    SELECT
      event_id,
      (SELECT sponsor_obj FROM ranked r2 WHERE r2.event_id = r.event_id AND r2.rn = 1) AS primary_sponsor,
      jsonb_agg(sponsor_obj ORDER BY rn) AS sponsors
    FROM ranked r
    GROUP BY event_id
  )
  SELECT event_id, primary_sponsor, sponsors FROM agg;
$$;

-- Updated feed function with non-duplicating sponsor join  
CREATE OR REPLACE FUNCTION public.get_home_feed_v2(
  p_user uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_cursor_ts timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
)
RETURNS TABLE(
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
  event_owner_context_type text,
  event_location text,
  author_id uuid,
  author_name text,
  author_badge text,
  author_social_links jsonb,
  media_urls text[],
  content text,
  metrics jsonb,
  sponsor jsonb,       -- primary sponsor
  sponsors jsonb       -- all sponsors (array)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _cursor_ts timestamptz := p_cursor_ts;
  _cursor_id uuid := p_cursor_id;
BEGIN
  RETURN QUERY
  WITH feed_items AS (
    -- Events
    SELECT
      'event'::text AS item_type,
      e.start_at     AS sort_ts,
      e.id           AS item_id,
      e.id           AS event_id,
      e.title        AS event_title,
      e.description  AS event_description,
      e.start_at     AS event_starts_at,
      e.cover_image_url AS event_cover_image,
      COALESCE(up.display_name, 'Organizer') AS event_organizer,
      e.created_by   AS event_organizer_id,
      e.owner_context_type::text AS event_owner_context_type,
      COALESCE(e.city, e.venue, 'TBA') AS event_location,
      NULL::uuid     AS author_id,
      NULL::text     AS author_name,
      NULL::text     AS author_badge,
      NULL::jsonb    AS author_social_links,
      NULL::text[]   AS media_urls,
      NULL::text     AS content,
      jsonb_build_object() AS metrics
    FROM public.events e
    LEFT JOIN public.user_profiles up ON up.user_id = e.created_by
    WHERE e.visibility = 'public'
      AND e.start_at > now() - interval '1 day'
      AND (_cursor_ts IS NULL OR e.start_at < _cursor_ts OR (e.start_at = _cursor_ts AND e.id < _cursor_id))

    UNION ALL

    -- Posts
    SELECT
      'post'::text AS item_type,
      p.created_at AS sort_ts,
      p.id         AS item_id,
      p.event_id,
      e.title      AS event_title,
      e.description AS event_description,
      e.start_at    AS event_starts_at,
      e.cover_image_url AS event_cover_image,
      COALESCE(oup.display_name, 'Organizer') AS event_organizer,
      e.created_by  AS event_organizer_id,
      e.owner_context_type::text AS event_owner_context_type,
      COALESCE(e.city, e.venue, 'TBA') AS event_location,
      p.author_user_id AS author_id,
      p.author_name,
      p.author_badge_label AS author_badge,
      COALESCE(aup.social_links, '[]'::jsonb) AS author_social_links,
      p.media_urls,
      p.text AS content,
      jsonb_build_object(
        'likes', COALESCE(p.like_count, 0),
        'comments', COALESCE(p.comment_count, 0)
      ) AS metrics
    FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    LEFT JOIN public.user_profiles oup ON oup.user_id = e.created_by
    LEFT JOIN public.user_profiles aup ON aup.user_id = p.author_user_id
    WHERE p.deleted_at IS NULL
      AND e.visibility = 'public'
      AND (_cursor_ts IS NULL OR p.created_at < _cursor_ts OR (p.created_at = _cursor_ts AND p.id < _cursor_id))
  ),
  limited AS (
    SELECT *
    FROM feed_items
    ORDER BY sort_ts DESC, item_id DESC
    LIMIT p_limit
  ),
  ev_ids AS (
    SELECT DISTINCT event_id FROM limited
  ),
  sponsors AS (
    SELECT * FROM public.get_active_event_sponsors(ARRAY(SELECT event_id FROM ev_ids))
  )
  SELECT
    lf.item_type,
    lf.sort_ts,
    lf.item_id,
    lf.event_id,
    lf.event_title,
    lf.event_description,
    lf.event_starts_at,
    lf.event_cover_image,
    lf.event_organizer,
    lf.event_organizer_id,
    lf.event_owner_context_type,
    lf.event_location,
    lf.author_id,
    lf.author_name,
    lf.author_badge,
    lf.author_social_links,
    lf.media_urls,
    lf.content,
    lf.metrics,
    CASE WHEN lf.item_type = 'event' THEN sp.primary_sponsor ELSE NULL END AS sponsor,
    CASE WHEN lf.item_type = 'event' THEN sp.sponsors        ELSE NULL END AS sponsors
  FROM limited lf
  LEFT JOIN sponsors sp ON sp.event_id = lf.event_id
  ORDER BY lf.sort_ts DESC, lf.item_id DESC;
END;
$$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_so_event_status_created ON public.sponsorship_orders(event_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_so_event_amount ON public.sponsorship_orders(event_id, amount_cents DESC);
CREATE INDEX IF NOT EXISTS idx_sp_is_active ON public.sponsorship_packages(id, is_active);
CREATE INDEX IF NOT EXISTS idx_events_visibility_start_id ON public.events(visibility, start_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_posts_event_created_id ON public.event_posts(event_id, created_at DESC, id DESC);