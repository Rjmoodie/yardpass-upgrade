-- Create function to surface active ad campaign creatives for placements like feed/search
CREATE OR REPLACE FUNCTION public.get_active_campaign_creatives(
  p_placement public.ad_placement,
  p_limit integer DEFAULT 8,
  p_user_id uuid DEFAULT NULL,
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE (
  campaign_id uuid,
  creative_id uuid,
  org_id uuid,
  event_id uuid,
  post_id uuid,
  objective public.campaign_objective,
  pacing_strategy public.pacing_strategy,
  headline text,
  body_text text,
  cta_label text,
  cta_url text,
  media_type public.creative_media_type,
  media_url text,
  poster_url text,
  event_title text,
  event_description text,
  event_cover_image text,
  event_starts_at timestamptz,
  event_location text,
  event_city text,
  event_category text,
  organizer_name text,
  organizer_id uuid,
  owner_context_type text,
  priority numeric,
  frequency_cap_per_user integer,
  frequency_cap_period public.frequency_period,
  targeting jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible_campaigns AS (
    SELECT
      c.id,
      c.org_id,
      c.objective,
      c.pacing_strategy,
      c.total_budget_credits,
      c.spent_credits,
      c.start_date,
      c.end_date,
      c.frequency_cap_per_user,
      c.frequency_cap_period,
      cp.placement,
      ct.locations,
      ct.categories,
      ct.keywords,
      ct.exclude_ticket_holders,
      ct.exclude_past_attendees
    FROM public.campaigns c
    JOIN public.campaign_placements cp ON cp.campaign_id = c.id
    LEFT JOIN public.campaign_targeting ct ON ct.campaign_id = c.id
    WHERE cp.placement = p_placement
      AND cp.enabled = TRUE
      AND c.status = 'active'
      AND c.start_date <= p_now
      AND (c.end_date IS NULL OR c.end_date >= p_now)
      AND c.total_budget_credits > c.spent_credits
  ),
  eligible_creatives AS (
    SELECT
      ec.*,
      ac.id AS creative_id,
      ac.headline,
      ac.body_text,
      ac.cta_label,
      ac.cta_url,
      ac.media_type,
      ac.media_url,
      ac.poster_url,
      ac.post_id,
      ac.updated_at
    FROM eligible_campaigns ec
    JOIN public.ad_creatives ac ON ac.campaign_id = ec.id AND ac.active = TRUE
  ),
  creative_events AS (
    SELECT
      ec.id AS campaign_id,
      ec.org_id,
      ec.objective,
      ec.pacing_strategy,
      ec.total_budget_credits,
      ec.spent_credits,
      ec.start_date,
      ec.end_date,
      ec.frequency_cap_per_user,
      ec.frequency_cap_period,
      ec.locations,
      ec.categories,
      ec.keywords,
      ec.exclude_ticket_holders,
      ec.exclude_past_attendees,
      ec.placement,
      ec.creative_id,
      ec.headline,
      ec.body_text,
      ec.cta_label,
      ec.cta_url,
      ec.media_type,
      ec.media_url,
      ec.poster_url,
      ec.post_id,
      ec.updated_at,
      COALESCE(ep.event_id, e.id) AS event_id,
      e.title AS event_title,
      e.description AS event_description,
      e.cover_image_url AS event_cover_image,
      e.start_at AS event_starts_at,
      e.city AS event_city,
      e.category AS event_category,
      e.venue,
      e.owner_context_type,
      e.owner_context_id,
      e.created_by,
      e.visibility
    FROM eligible_creatives ec
    LEFT JOIN public.event_posts ep ON ep.id = ec.post_id
    LEFT JOIN public.events e ON e.id = COALESCE(ep.event_id, ec.post_id)
  )
  SELECT
    ce.campaign_id,
    ce.creative_id,
    ce.org_id,
    ce.event_id,
    ce.post_id,
    ce.objective,
    ce.pacing_strategy,
    ce.headline,
    ce.body_text,
    ce.cta_label,
    ce.cta_url,
    ce.media_type,
    ce.media_url,
    ce.poster_url,
    ce.event_title,
    ce.event_description,
    ce.event_cover_image,
    ce.event_starts_at,
    CASE
      WHEN ce.venue IS NOT NULL AND ce.event_city IS NOT NULL THEN ce.venue || ', ' || ce.event_city
      WHEN ce.venue IS NOT NULL THEN ce.venue
      ELSE ce.event_city
    END AS event_location,
    ce.event_city,
    ce.event_category,
    CASE
      WHEN ce.owner_context_type = 'organization' THEN org.name
      ELSE prof.display_name
    END AS organizer_name,
    CASE
      WHEN ce.owner_context_type = 'organization' THEN ce.owner_context_id
      ELSE ce.created_by
    END AS organizer_id,
    ce.owner_context_type,
    (
      -- pacing boost
      CASE WHEN ce.pacing_strategy = 'accelerated' THEN 1.4 ELSE 1 END
      +
      -- budget remaining boost (0..1)
      COALESCE(GREATEST(0, LEAST(1, (ce.total_budget_credits - ce.spent_credits)::numeric / NULLIF(ce.total_budget_credits, 0))), 0)
      +
      -- recency boost (favor creatives refreshed recently)
      LEAST(1.0, COALESCE(EXTRACT(EPOCH FROM (p_now - ce.updated_at)) / 86400.0, 1.0) * -0.1 + 1.0)
    ) AS priority,
    ce.frequency_cap_per_user,
    ce.frequency_cap_period,
    jsonb_strip_nulls(jsonb_build_object(
      'locations', ce.locations,
      'categories', ce.categories,
      'keywords', ce.keywords,
      'exclude_ticket_holders', ce.exclude_ticket_holders,
      'exclude_past_attendees', ce.exclude_past_attendees
    )) AS targeting
  FROM creative_events ce
  LEFT JOIN public.organizations org ON org.id = ce.owner_context_id
  LEFT JOIN public.user_profiles prof ON prof.user_id = ce.created_by
  WHERE ce.event_id IS NOT NULL
    AND (ce.visibility IS NULL OR ce.visibility = 'public')
  ORDER BY priority DESC, ce.updated_at DESC
  LIMIT COALESCE(NULLIF(p_limit, 0), 8);
$$;

GRANT EXECUTE ON FUNCTION public.get_active_campaign_creatives(public.ad_placement, integer, uuid, timestamptz)
TO anon, authenticated;
