-- Update the get_home_feed function with improved logic and safety
CREATE OR REPLACE FUNCTION public.get_home_feed(
  p_user_id uuid DEFAULT NULL,  -- kept for future personalization
  p_limit   integer DEFAULT 5
)
RETURNS TABLE(
  event_id               uuid,
  title                  text,
  description            text,
  start_at               timestamptz,
  cover_image_url        text,
  city                   text,
  venue                  text,
  created_by             uuid,
  owner_context_type     owner_context,
  owner_context_id       uuid,
  organizer_display_name text,         -- from user profile (creator)
  organization_name      text,         -- from organizations
  organizer_name         text,         -- coalesced name to "just use"
  organization_id        uuid          -- null unless org-owned
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $function$
  SELECT
    e.id                              AS event_id,
    e.title,
    e.description,
    e.start_at,
    e.cover_image_url,
    e.city,
    e.venue,
    e.created_by,
    e.owner_context_type,
    e.owner_context_id,
    up.display_name                   AS organizer_display_name,
    o.name                            AS organization_name,
    COALESCE(o.name, up.display_name) AS organizer_name,
    CASE WHEN e.owner_context_type = 'organization'::owner_context
         THEN e.owner_context_id
         ELSE NULL
    END                               AS organization_id
  FROM public.events e
  JOIN public.user_profiles up
    ON up.user_id = e.created_by
  LEFT JOIN public.organizations o
    ON o.id = e.owner_context_id
   AND e.owner_context_type = 'organization'::owner_context
  WHERE e.visibility = 'public'
    AND e.start_at > now()
  ORDER BY e.start_at ASC
  LIMIT p_limit;
$function$;