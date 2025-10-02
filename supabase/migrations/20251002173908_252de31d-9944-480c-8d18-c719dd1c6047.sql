-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.rpc_campaign_analytics_daily(uuid, date, date, uuid[]);
DROP FUNCTION IF EXISTS public.rpc_creative_analytics_rollup(uuid, date, date, uuid[], uuid[], boolean, text, text, integer, integer);

-- 1) rpc_campaign_analytics_daily (hardened)
CREATE OR REPLACE FUNCTION public.rpc_campaign_analytics_daily(
  p_org_id uuid,
  p_from date,
  p_to date,
  p_campaign_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  org_id uuid,
  campaign_id uuid,
  date date,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  revenue_cents bigint,
  credits_spent bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Validate inputs
  SELECT
    cad.org_id,
    cad.campaign_id,
    cad.date,
    cad.impressions,
    cad.clicks,
    cad.conversions,
    cad.revenue_cents,
    cad.credits_spent
  FROM campaign_analytics_daily cad
  WHERE cad.org_id = p_org_id
    AND cad.date BETWEEN p_from AND p_to
    AND (
      p_campaign_ids IS NULL
      OR array_length(p_campaign_ids,1) IS NULL
      OR cad.campaign_id = ANY(p_campaign_ids)
    )
    -- Enforce org membership
    AND EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id = p_org_id AND om.user_id = auth.uid()
    )
  ORDER BY cad.date ASC, cad.campaign_id ASC;
$$;

-- Lock down exec
REVOKE ALL ON FUNCTION public.rpc_campaign_analytics_daily(uuid, date, date, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_campaign_analytics_daily(uuid, date, date, uuid[]) TO authenticated;

-- 2) rpc_creative_analytics_rollup (hardened + CTR + stable paging)
CREATE OR REPLACE FUNCTION public.rpc_creative_analytics_rollup(
  p_org_id uuid,
  p_from date,
  p_to date,
  p_campaign_ids uuid[] DEFAULT NULL,
  p_creative_ids uuid[] DEFAULT NULL,
  p_include_series boolean DEFAULT false,
  p_sort text DEFAULT 'impressions',
  p_dir  text DEFAULT 'desc',
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  org_id uuid,
  campaign_id uuid,
  campaign_name text,
  creative_id uuid,
  headline text,
  media_type text,
  active boolean,
  poster_url text,
  media_url text,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  revenue_cents bigint,
  credits_spent bigint,
  ctr numeric,
  daily_series jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sort text := lower(coalesce(p_sort,'impressions'));
  v_dir  text := case when lower(p_dir) = 'asc' then 'asc' else 'desc' end;
  v_limit int := greatest(1, least(coalesce(p_limit,100), 1000));
  v_offset int := greatest(0, coalesce(p_offset,0));
BEGIN
  -- Membership check
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships om
    WHERE om.org_id = p_org_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized for this organization' USING ERRCODE = '42501';
  END IF;

  -- Whitelist sort field
  IF v_sort NOT IN ('impressions','clicks','ctr','credits_spent','revenue_cents') THEN
    v_sort := 'impressions';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      cad.org_id,
      cad.campaign_id,
      cad.creative_id,
      SUM(cad.impressions)::bigint      AS impressions,
      SUM(cad.clicks)::bigint           AS clicks,
      SUM(cad.conversions)::bigint      AS conversions,
      COALESCE(SUM(cad.revenue_cents),0)::bigint   AS revenue_cents,
      COALESCE(SUM(cad.credits_spent),0)::bigint   AS credits_spent
    FROM creative_analytics_daily cad
    WHERE cad.org_id = p_org_id
      AND cad.date BETWEEN p_from AND p_to
      AND (p_campaign_ids IS NULL OR array_length(p_campaign_ids,1) IS NULL OR cad.campaign_id = ANY(p_campaign_ids))
      AND (p_creative_ids IS NULL OR array_length(p_creative_ids,1) IS NULL OR cad.creative_id  = ANY(p_creative_ids))
    GROUP BY cad.org_id, cad.campaign_id, cad.creative_id
  ),
  meta AS (
    SELECT
      ac.id AS creative_id,
      ac.campaign_id,
      ac.headline,
      ac.media_type::text AS media_type,
      ac.active,
      ac.poster_url,
      ac.media_url,
      c.org_id,
      c.name AS campaign_name
    FROM ad_creatives ac
    JOIN campaigns c ON c.id = ac.campaign_id
    WHERE c.org_id = p_org_id
  ),
  joined AS (
    SELECT
      m.org_id,
      m.campaign_id,
      m.campaign_name,
      m.creative_id,
      m.headline,
      m.media_type,
      m.active,
      m.poster_url,
      m.media_url,
      b.impressions,
      b.clicks,
      b.conversions,
      b.revenue_cents,
      b.credits_spent,
      CASE WHEN b.impressions > 0 THEN (b.clicks::numeric / b.impressions::numeric) ELSE 0 END AS ctr
    FROM base b
    JOIN meta m
      ON m.creative_id = b.creative_id AND m.campaign_id = b.campaign_id AND m.org_id = b.org_id
  ),
  ranked AS (
    SELECT j.*,
      CASE v_sort
        WHEN 'clicks'        THEN j.clicks::numeric
        WHEN 'ctr'           THEN j.ctr
        WHEN 'credits_spent' THEN j.credits_spent::numeric
        WHEN 'revenue_cents' THEN j.revenue_cents::numeric
        ELSE j.impressions::numeric
      END AS sort_key
    FROM joined j
  ),
  limited AS (
    SELECT *
    FROM ranked
    ORDER BY
      CASE WHEN v_dir = 'asc' THEN NULL ELSE sort_key END DESC,
      CASE WHEN v_dir = 'asc' THEN sort_key END ASC,
      campaign_id, creative_id
    LIMIT v_limit OFFSET v_offset
  ),
  series_data AS (
    SELECT
      l.creative_id,
      jsonb_agg(
        jsonb_build_object(
          'date', cad.date,
          'impressions', cad.impressions,
          'clicks', cad.clicks,
          'conversions', cad.conversions,
          'revenue_cents', cad.revenue_cents,
          'credits_spent', cad.credits_spent
        )
        ORDER BY cad.date ASC
      ) AS series
    FROM limited l
    JOIN creative_analytics_daily cad
      ON cad.creative_id = l.creative_id
     AND cad.org_id = p_org_id
     AND cad.date BETWEEN p_from AND p_to
     AND (p_campaign_ids IS NULL OR array_length(p_campaign_ids,1) IS NULL OR cad.campaign_id = ANY(p_campaign_ids))
    GROUP BY l.creative_id
  )
  SELECT
    l.org_id,
    l.campaign_id,
    l.campaign_name,
    l.creative_id,
    l.headline,
    l.media_type,
    l.active,
    l.poster_url,
    l.media_url,
    l.impressions,
    l.clicks,
    l.conversions,
    l.revenue_cents,
    l.credits_spent,
    l.ctr,
    CASE WHEN p_include_series THEN sd.series ELSE NULL END AS daily_series
  FROM limited l
  LEFT JOIN series_data sd USING (creative_id)
  ORDER BY
    CASE WHEN v_dir = 'asc' THEN NULL ELSE l.sort_key END DESC,
    CASE WHEN v_dir = 'asc' THEN l.sort_key END ASC,
    l.campaign_id, l.creative_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_creative_analytics_rollup(
  uuid, date, date, uuid[], uuid[], boolean, text, text, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rpc_creative_analytics_rollup(
  uuid, date, date, uuid[], uuid[], boolean, text, text, integer, integer
) TO authenticated;