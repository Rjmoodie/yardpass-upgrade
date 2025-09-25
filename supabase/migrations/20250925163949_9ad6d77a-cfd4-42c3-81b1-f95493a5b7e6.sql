-- Create lean RPC for hero feed (minimal fields for first paint)
CREATE OR REPLACE FUNCTION public.get_hero_feed(p_limit integer DEFAULT 5)
RETURNS TABLE(
  id uuid,
  title text,
  start_at timestamptz,
  city text,
  venue text,
  cover_image_url text,
  organizer_display_name text,
  created_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.title,
    e.start_at,
    e.city,
    e.venue,
    e.cover_image_url,
    up.display_name as organizer_display_name,
    e.created_by
  FROM events e
  JOIN user_profiles up ON up.user_id = e.created_by
  WHERE e.visibility = 'public'
    AND e.start_at > now()
  ORDER BY e.start_at ASC
  LIMIT p_limit;
$$;