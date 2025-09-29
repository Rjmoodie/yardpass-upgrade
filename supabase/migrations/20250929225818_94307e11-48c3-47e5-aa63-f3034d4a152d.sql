-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_home_feed(uuid, integer, integer);

-- Recreate get_home_feed RPC with resolved organizer names/ids
CREATE OR REPLACE FUNCTION public.get_home_feed(
  p_user_id uuid DEFAULT NULL,
  p_limit   integer DEFAULT 40,
  p_offset  integer DEFAULT 0
)
RETURNS TABLE(
  event_id uuid,
  title text,
  description text,
  start_at timestamptz,
  cover_image_url text,
  city text,
  venue text,
  created_by uuid,
  owner_context_type owner_context,
  owner_context_id uuid,
  organizer_display_name text,
  organization_name text,
  -- NEW: resolved values the client should use
  organizer_name text,
  organizer_id uuid,
  -- Keep recent_posts for compatibility
  recent_posts jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    e.id                               AS event_id,
    e.title,
    e.description,
    e.start_at,
    e.cover_image_url,
    e.city,
    e.venue,
    e.created_by,
    e.owner_context_type,
    e.owner_context_id,
    up.display_name                    AS organizer_display_name,
    o.name                             AS organization_name,
    /* ✅ resolved organizer fields */
    CASE
      WHEN e.owner_context_type = 'organization' AND o.name IS NOT NULL
        THEN o.name
      ELSE up.display_name
    END                                AS organizer_name,
    CASE
      WHEN e.owner_context_type = 'organization'
        THEN e.owner_context_id
      ELSE e.created_by
    END                                AS organizer_id,
    /* recent_posts for compatibility */
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'text', p.text,
          'created_at', p.created_at,
          'media_urls', p.media_urls,
          'like_count', p.like_count,
          'comment_count', p.comment_count,
          'author', jsonb_build_object(
            'id', p.author_user_id,
            'display_name', pup.display_name,
            'badge_label', CASE 
              WHEN p.author_user_id = e.created_by THEN 'ORGANIZER'
              ELSE 'ATTENDEE'
            END
          )
        )
      )
      FROM (
        SELECT p.*, ROW_NUMBER() OVER (ORDER BY p.created_at DESC) as rn
        FROM event_posts p
        LEFT JOIN user_profiles pup ON pup.user_id = p.author_user_id
        WHERE p.event_id = e.id AND p.deleted_at IS NULL
      ) p
      LEFT JOIN user_profiles pup ON pup.user_id = p.author_user_id
      WHERE p.rn <= 3
    ), '[]'::jsonb)                    AS recent_posts
  FROM events e
  JOIN user_profiles up ON up.user_id = e.created_by
  LEFT JOIN organizations o ON o.id = e.owner_context_id
  WHERE e.visibility = 'public'
    AND e.start_at > now()
  ORDER BY e.start_at ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;