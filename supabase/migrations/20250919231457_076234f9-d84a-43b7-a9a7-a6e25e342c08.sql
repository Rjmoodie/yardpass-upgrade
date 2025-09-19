-- Fix the search_all function to not reference the deleted materialized view
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
  item_type text,
  item_id uuid,
  title text,
  description text,
  content text,
  category text,
  created_at timestamp with time zone,
  cover_image_url text,
  organizer_name text,
  location text,
  start_at timestamp with time zone,
  visibility text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Simple search without materialized view dependency
  SELECT 
    'event'::text as item_type,
    e.id as item_id,
    e.title,
    e.description,
    e.description as content,
    e.category,
    e.created_at,
    e.cover_image_url,
    up.display_name as organizer_name,
    COALESCE(e.city, e.venue, 'TBA') as location,
    e.start_at,
    e.visibility::text
  FROM events e
  JOIN user_profiles up ON up.user_id = e.created_by
  WHERE 
    (p_q = '' OR e.title ILIKE '%' || p_q || '%' OR e.description ILIKE '%' || p_q || '%')
    AND (p_category IS NULL OR e.category = p_category)
    AND (p_date_from IS NULL OR e.start_at >= p_date_from::timestamp)
    AND (p_date_to IS NULL OR e.start_at <= p_date_to::timestamp)
    AND (e.visibility = 'public' OR (p_user IS NOT NULL AND can_view_event(p_user, e.id)))
  ORDER BY e.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$function$;