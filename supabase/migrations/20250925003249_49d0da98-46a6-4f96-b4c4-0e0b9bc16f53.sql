-- Update get_home_feed RPC function to exclude past events
CREATE OR REPLACE FUNCTION public.get_home_feed(p_user_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS SETOF home_feed_row
 LANGUAGE sql
 STABLE
AS $function$
  WITH rel_events AS (
    SELECT e.*
    FROM public.events e
    WHERE
      -- Only include future events (exclude past events)
      e.start_at >= now()
      AND (
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

    -- recent_posts: top 3 posts w/ author info AND badge information
    COALESCE(
      (
        SELECT jsonb_agg(post_data ORDER BY post_created_at DESC)
        FROM (
          SELECT 
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
                 'is_organizer', (p.author_user_id = e.created_by),
                 'badge_label',  get_user_highest_tier_badge(p.author_user_id, e.id)
              )
            ) as post_data,
            p.created_at as post_created_at
          FROM public.event_posts p
          JOIN public.user_profiles aup
            ON aup.user_id = p.author_user_id
          WHERE p.event_id = e.id
            AND p.deleted_at IS NULL
          ORDER BY p.created_at DESC
          LIMIT 3
        ) recent_posts_subq
      ),
      '[]'::jsonb
    ) AS recent_posts,

    -- ticket_tiers: compact array
    COALESCE(
      (
        SELECT jsonb_agg(tier_data ORDER BY tier_sort_index ASC, tier_created_at ASC)
        FROM (
          SELECT 
            jsonb_build_object(
              'id',           tt.id,
              'name',         tt.name,
              'price_cents',  tt.price_cents,
              'badge_label',  tt.badge_label,
              'quantity',     tt.quantity
            ) as tier_data,
            tt.sort_index as tier_sort_index,
            tt.created_at as tier_created_at
          FROM public.ticket_tiers tt
          WHERE tt.event_id = e.id
            AND tt.status = 'active'
          ORDER BY tt.sort_index ASC, tt.created_at ASC
        ) tiers_subq
      ),
      '[]'::jsonb
    ) AS ticket_tiers

  FROM rel_events e
  JOIN public.user_profiles up
    ON up.user_id = e.created_by
  ORDER BY e.start_at ASC
  LIMIT p_limit
  OFFSET p_offset;
$function$;