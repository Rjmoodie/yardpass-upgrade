-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_home_feed(uuid, integer, integer);

-- 1) Safer recreate type (idempotent-ish)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'home_feed_row') THEN
    DROP TYPE public.home_feed_row CASCADE;
  END IF;
END$$;

CREATE TYPE public.home_feed_row AS (
  event_id uuid,
  title text,
  description text,
  category text,
  cover_image_url text,
  start_at timestamptz,
  end_at timestamptz,
  venue text,
  city text,
  visibility event_visibility,
  created_by uuid,
  organizer_display_name text,
  organizer_avatar_url text,
  recent_posts jsonb,   -- array of up to 3 posts (see shape below)
  ticket_tiers jsonb    -- array of compact tiers
);

-- 2) Create/replace RPC
CREATE OR REPLACE FUNCTION public.get_home_feed(
  p_user_id uuid DEFAULT NULL,
  p_limit   int  DEFAULT 20,
  p_offset  int  DEFAULT 0
)
RETURNS SETOF public.home_feed_row
LANGUAGE sql
STABLE
AS $$
  WITH rel_events AS (
    SELECT e.*
    FROM public.events e
    WHERE
      -- anonymous → only public events
      (p_user_id IS NULL AND e.visibility = 'public')
      -- logged-in → related events (organizer OR ticket holder) OR public
      OR (p_user_id IS NOT NULL AND (
           e.created_by = p_user_id
        OR EXISTS (
            SELECT 1
            FROM public.tickets t
            WHERE t.event_id = e.id
              AND t.owner_user_id = p_user_id
              AND t.status = 'issued'
          )
        OR e.visibility = 'public'
      ))
  )
  SELECT
    e.id                         AS event_id,
    e.title,
    e.description,
    e.category,
    e.cover_image_url,
    e.start_at,
    e.end_at,
    e.venue,
    e.city,
    e.visibility,
    e.created_by,
    up.display_name              AS organizer_display_name,
    up.photo_url                 AS organizer_avatar_url,

    -- recent_posts: top 3 posts w/ author info
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id',           p.id,
                   'text',         p.text,
                   'created_at',   p.created_at,
                   'like_count',   p.like_count,
                   'comment_count',p.comment_count,
                   'media_urls',   COALESCE(p.media_urls, '{}'),
                   'author', jsonb_build_object(
                      'id',           p.author_user_id,
                      'display_name', aup.display_name,
                      'avatar_url',   aup.photo_url,
                      'is_organizer', (p.author_user_id = e.created_by)
                   )
                 )
               ORDER BY p.created_at DESC
               )
        FROM public.event_posts p
        JOIN public.user_profiles aup
          ON aup.user_id = p.author_user_id
        WHERE p.event_id = e.id
          AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
        LIMIT 3
      ),
      '[]'::jsonb
    ) AS recent_posts,

    -- ticket_tiers: compact array
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'id',           tt.id,
                   'name',         tt.name,
                   'price_cents',  tt.price_cents,
                   'badge_label',  tt.badge_label,
                   'quantity',     tt.quantity
                 )
                 ORDER BY tt.sort_index ASC, tt.created_at ASC
               )
        FROM public.ticket_tiers tt
        WHERE tt.event_id = e.id
          AND tt.status = 'active'
      ),
      '[]'::jsonb
    ) AS ticket_tiers

  FROM rel_events e
  JOIN public.user_profiles up
    ON up.user_id = e.created_by
  ORDER BY e.start_at ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;