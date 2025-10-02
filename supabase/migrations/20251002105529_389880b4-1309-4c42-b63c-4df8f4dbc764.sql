-- 1) Drop existing MV if present
DROP MATERIALIZED VIEW IF EXISTS campaign_analytics_daily;

-- 2) Create MV structure WITHOUT data (so we can index before first refresh)
CREATE MATERIALIZED VIEW campaign_analytics_daily
AS
WITH imp AS (
  SELECT
    campaign_id,
    (date_trunc('day', created_at AT TIME ZONE 'UTC'))::date AS date_utc,
    COUNT(*) AS impressions
  FROM ad_impressions
  GROUP BY 1, 2
),
clk AS (
  SELECT
    campaign_id,
    (date_trunc('day', created_at AT TIME ZONE 'UTC'))::date AS date_utc,
    COUNT(*) AS clicks,
    COUNT(*) FILTER (WHERE converted) AS conversions,
    COALESCE(SUM(conversion_value_cents) FILTER (WHERE converted), 0) AS revenue_cents
  FROM ad_clicks
  GROUP BY 1, 2
),
spend AS (
  SELECT
    campaign_id,
    (date_trunc('day', occurred_at AT TIME ZONE 'UTC'))::date AS date_utc,
    COALESCE(SUM(credits_charged), 0) AS credits_spent
  FROM ad_spend_ledger
  GROUP BY 1, 2
),
days AS (
  SELECT
    c.id AS campaign_id,
    c.org_id,
    gs::date AS date_utc
  FROM campaigns c
  CROSS JOIN generate_series(
    (date_trunc('day', c.start_date AT TIME ZONE 'UTC'))::date,
    LEAST(
      (date_trunc('day', COALESCE(c.end_date, now()) AT TIME ZONE 'UTC'))::date,
      (date_trunc('day', now() AT TIME ZONE 'UTC'))::date
    ),
    interval '1 day'
  ) AS gs
)
SELECT
  d.campaign_id,
  d.org_id,
  d.date_utc AS date,
  COALESCE(imp.impressions,     0) AS impressions,
  COALESCE(clk.clicks,          0) AS clicks,
  COALESCE(clk.conversions,     0) AS conversions,
  COALESCE(clk.revenue_cents,   0) AS revenue_cents,
  COALESCE(spend.credits_spent, 0) AS credits_spent
FROM days d
LEFT JOIN imp   ON imp.campaign_id = d.campaign_id AND imp.date_utc   = d.date_utc
LEFT JOIN clk   ON clk.campaign_id = d.campaign_id AND clk.date_utc   = d.date_utc
LEFT JOIN spend ON spend.campaign_id = d.campaign_id AND spend.date_utc = d.date_utc
WITH NO DATA;

COMMENT ON MATERIALIZED VIEW campaign_analytics_daily
  IS 'Daily analytics per campaign (UTC): impressions/clicks/conversions/revenue/credits_spent. Facts aggregated independently and left-joined to per-campaign day series.';

-- Unique index required for CONCURRENT refreshes
CREATE UNIQUE INDEX uq_campaign_analytics_daily
  ON campaign_analytics_daily (campaign_id, date);

-- Query helpers
CREATE INDEX idx_campaign_analytics_daily_org_date
  ON campaign_analytics_daily (org_id, date DESC);

CREATE INDEX idx_campaign_analytics_daily_campaign_date
  ON campaign_analytics_daily (campaign_id, date DESC);

-- First populate (non-concurrent since it's empty)
REFRESH MATERIALIZED VIEW campaign_analytics_daily;

-- Refresh function with concurrent support for future refreshes
CREATE OR REPLACE FUNCTION refresh_campaign_analytics(p_concurrently boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_concurrently THEN
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_analytics_daily';
  ELSE
    EXECUTE 'REFRESH MATERIALIZED VIEW campaign_analytics_daily';
  END IF;
END;
$$;

-- Restrict who can run it
REVOKE ALL ON FUNCTION refresh_campaign_analytics(boolean) FROM PUBLIC;

-- Secured barrier view filtered by org membership
CREATE OR REPLACE VIEW campaign_analytics_daily_secured
WITH (security_barrier = true)
AS
SELECT mv.campaign_id,
       mv.org_id,
       mv.date,
       mv.impressions,
       mv.clicks,
       mv.conversions,
       mv.revenue_cents,
       mv.credits_spent
FROM campaign_analytics_daily mv
WHERE EXISTS (
  SELECT 1
  FROM public.org_memberships om
  WHERE om.org_id = mv.org_id
    AND om.user_id = auth.uid()
);

COMMENT ON VIEW campaign_analytics_daily_secured
IS 'Barrier view over campaign_analytics_daily, filtered by org membership via auth.uid().';

GRANT SELECT ON campaign_analytics_daily_secured TO authenticated;

-- Parameterized RPC for date range + optional campaign filter
CREATE OR REPLACE FUNCTION public.rpc_campaign_analytics_daily(
  p_org_id uuid,
  p_from date,
  p_to date,
  p_campaign_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  campaign_id uuid,
  org_id uuid,
  date date,
  impressions integer,
  clicks integer,
  conversions integer,
  revenue_cents integer,
  credits_spent integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mv.campaign_id,
         mv.org_id,
         mv.date,
         mv.impressions,
         mv.clicks,
         mv.conversions,
         mv.revenue_cents,
         mv.credits_spent
  FROM campaign_analytics_daily mv
  WHERE mv.org_id = p_org_id
    AND mv.date BETWEEN p_from AND p_to
    AND (p_campaign_ids IS NULL OR mv.campaign_id = ANY(p_campaign_ids))
    AND EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id = p_org_id
        AND om.user_id = auth.uid()
    )
  ORDER BY mv.date ASC, mv.campaign_id ASC;
$$;

REVOKE ALL ON FUNCTION public.rpc_campaign_analytics_daily(uuid, date, date, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_campaign_analytics_daily(uuid, date, date, uuid[]) TO authenticated;