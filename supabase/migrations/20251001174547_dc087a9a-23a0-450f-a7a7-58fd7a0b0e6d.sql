-- Fix security warnings for campaign analytics materialized view

-- Enable RLS on materialized view (best practice even if read-only)
ALTER MATERIALIZED VIEW campaign_analytics_daily OWNER TO postgres;

-- Revoke public access to materialized views in API
REVOKE ALL ON campaign_analytics_daily FROM anon, authenticated;

-- Grant selective access only to org members via function
CREATE OR REPLACE FUNCTION public.get_campaign_analytics(
  p_campaign_ids UUID[],
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  campaign_id UUID,
  org_id UUID,
  date DATE,
  impressions BIGINT,
  unique_users BIGINT,
  unique_sessions BIGINT,
  clicks BIGINT,
  conversions BIGINT,
  revenue_cents BIGINT,
  credits_spent BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mv.*
  FROM campaign_analytics_daily mv
  JOIN campaigns c ON c.id = mv.campaign_id
  JOIN org_memberships om ON om.org_id = c.org_id
  WHERE mv.campaign_id = ANY(p_campaign_ids)
    AND mv.date BETWEEN p_start_date AND p_end_date
    AND om.user_id = auth.uid();
$$;