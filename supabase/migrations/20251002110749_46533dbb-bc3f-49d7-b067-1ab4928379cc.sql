-- A) Schema: attribute impressions/clicks to creative_id
ALTER TABLE public.ad_impressions
  ADD COLUMN IF NOT EXISTS creative_id uuid REFERENCES public.ad_creatives(id);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_creative_date
  ON public.ad_impressions(creative_id, created_at DESC);

ALTER TABLE public.ad_clicks
  ADD COLUMN IF NOT EXISTS creative_id uuid REFERENCES public.ad_creatives(id);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_creative_date
  ON public.ad_clicks(creative_id, created_at DESC);

ALTER TABLE public.ad_spend_ledger
  ADD COLUMN IF NOT EXISTS creative_id uuid REFERENCES public.ad_creatives(id);

CREATE INDEX IF NOT EXISTS idx_ad_spend_creative_date
  ON public.ad_spend_ledger(creative_id, occurred_at DESC);

-- B) Creative-level MV (UTC, concurrent-refreshable)
DROP MATERIALIZED VIEW IF EXISTS creative_analytics_daily;

CREATE MATERIALIZED VIEW creative_analytics_daily
AS
WITH imp AS (
  SELECT
    creative_id,
    date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS date_utc,
    COUNT(*) AS impressions
  FROM ad_impressions
  WHERE creative_id IS NOT NULL
  GROUP BY 1, 2
),
clk AS (
  SELECT
    creative_id,
    date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS date_utc,
    COUNT(*) AS clicks,
    COUNT(*) FILTER (WHERE converted) AS conversions,
    COALESCE(SUM(conversion_value_cents) FILTER (WHERE converted), 0) AS revenue_cents
  FROM ad_clicks
  WHERE creative_id IS NOT NULL
  GROUP BY 1, 2
),
spend AS (
  SELECT
    creative_id,
    date_trunc('day', occurred_at AT TIME ZONE 'UTC')::date AS date_utc,
    COALESCE(SUM(credits_charged), 0) AS credits_spent
  FROM ad_spend_ledger
  WHERE creative_id IS NOT NULL
  GROUP BY 1, 2
),
days AS (
  SELECT
    ac.id  AS creative_id,
    c.id   AS campaign_id,
    c.org_id,
    gs::date AS date_utc
  FROM public.ad_creatives ac
  JOIN public.campaigns c ON c.id = ac.campaign_id
  CROSS JOIN generate_series(
    date_trunc('day', c.start_date AT TIME ZONE 'UTC')::date,
    LEAST(
      date_trunc('day', COALESCE(c.end_date, now()) AT TIME ZONE 'UTC')::date,
      date_trunc('day', now() AT TIME ZONE 'UTC')::date
    ),
    interval '1 day'
  ) AS gs
)
SELECT
  d.creative_id,
  d.campaign_id,
  d.org_id,
  d.date_utc AS date,
  COALESCE(imp.impressions,     0) AS impressions,
  COALESCE(clk.clicks,          0) AS clicks,
  COALESCE(clk.conversions,     0) AS conversions,
  COALESCE(clk.revenue_cents,   0) AS revenue_cents,
  COALESCE(spend.credits_spent, 0) AS credits_spent
FROM days d
LEFT JOIN imp   ON imp.creative_id = d.creative_id AND imp.date_utc   = d.date_utc
LEFT JOIN clk   ON clk.creative_id = d.creative_id AND clk.date_utc   = d.date_utc
LEFT JOIN spend ON spend.creative_id = d.creative_id AND spend.date_utc = d.date_utc
WITH NO DATA;

COMMENT ON MATERIALIZED VIEW creative_analytics_daily
  IS 'Daily analytics per creative (UTC): impressions/clicks/conversions/revenue/credits_spent.';

-- Indexes
CREATE UNIQUE INDEX uq_creative_analytics_daily
  ON creative_analytics_daily (creative_id, date);

CREATE INDEX idx_creative_analytics_daily_campaign_date
  ON creative_analytics_daily (campaign_id, date DESC);

CREATE INDEX idx_creative_analytics_daily_org_date
  ON creative_analytics_daily (org_id, date DESC);

-- First refresh
REFRESH MATERIALIZED VIEW creative_analytics_daily;

-- C) Secure access
-- Barrier view that enforces org membership
CREATE OR REPLACE VIEW creative_analytics_daily_secured
WITH (security_barrier = true)
AS
SELECT cad.creative_id,
       cad.campaign_id,
       cad.org_id,
       cad.date,
       cad.impressions,
       cad.clicks,
       cad.conversions,
       cad.revenue_cents,
       cad.credits_spent
FROM creative_analytics_daily cad
WHERE EXISTS (
  SELECT 1
  FROM public.org_memberships om
  WHERE om.org_id = cad.org_id
    AND om.user_id = auth.uid()
);

GRANT SELECT ON creative_analytics_daily_secured TO authenticated;

-- RPC with filters
CREATE OR REPLACE FUNCTION public.rpc_creative_analytics_daily(
  p_org_id uuid,
  p_from date,
  p_to date,
  p_campaign_ids uuid[] DEFAULT NULL,
  p_creative_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  creative_id uuid,
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
  SELECT cad.creative_id,
         cad.campaign_id,
         cad.org_id,
         cad.date,
         cad.impressions,
         cad.clicks,
         cad.conversions,
         cad.revenue_cents,
         cad.credits_spent
  FROM creative_analytics_daily cad
  WHERE cad.org_id = p_org_id
    AND cad.date BETWEEN p_from AND p_to
    AND (p_campaign_ids IS NULL OR cad.campaign_id = ANY(p_campaign_ids))
    AND (p_creative_ids IS NULL OR cad.creative_id  = ANY(p_creative_ids))
    AND EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id = p_org_id AND om.user_id = auth.uid()
    )
  ORDER BY cad.date ASC, cad.campaign_id ASC, cad.creative_id ASC;
$$;

REVOKE ALL ON FUNCTION public.rpc_creative_analytics_daily(uuid, date, date, uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_creative_analytics_daily(uuid, date, date, uuid[], uuid[]) TO authenticated;

-- E) Combined refresh helper for both MVs
CREATE OR REPLACE FUNCTION refresh_ads_analytics(p_concurrently boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t1 TIMESTAMPTZ := clock_timestamp();
  t2 TIMESTAMPTZ;
BEGIN
  IF p_concurrently THEN
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_analytics_daily';
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY creative_analytics_daily';
  ELSE
    EXECUTE 'REFRESH MATERIALIZED VIEW campaign_analytics_daily';
    EXECUTE 'REFRESH MATERIALIZED VIEW creative_analytics_daily';
  END IF;
  
  t2 := clock_timestamp();
  INSERT INTO mv_refresh_log(concurrent, duration_ms, note)
  VALUES (p_concurrently, EXTRACT(MILLISECONDS FROM t2 - t1), 'ads_analytics (campaign + creative)');
END;
$$;

REVOKE ALL ON FUNCTION refresh_ads_analytics(boolean) FROM PUBLIC;

-- Update cron job to refresh both MVs
SELECT cron.unschedule('campaign_analytics_refresh_10min');
SELECT cron.schedule(
  'ads_analytics_refresh_10min',
  '*/10 * * * *',
  $$ SELECT refresh_ads_analytics(true); $$
);