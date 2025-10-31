-- ================================================================
-- View: public.campaigns_overview
-- Purpose: Provides aggregated delivery metrics and pacing intelligence 
--          for campaign dashboards with 7-day and 30-day performance data
-- Security: Inherits RLS from campaigns.campaigns. Users see only campaigns 
--           for orgs they belong to.
-- ================================================================

-- Drop existing view if it exists (for safe re-runs)
DROP VIEW IF EXISTS public.campaigns_overview CASCADE;

-- Create the campaigns_overview view
CREATE OR REPLACE VIEW public.campaigns_overview AS
WITH creative_counts AS (
  SELECT
    ac.campaign_id,
    COUNT(*) AS total_creatives,
    COUNT(*) FILTER (WHERE ac.active) AS active_creatives,
    MAX(ac.updated_at) AS last_creative_update
  FROM campaigns.ad_creatives ac
  GROUP BY ac.campaign_id
),
ledger_totals AS (
  SELECT
    l.campaign_id,
    SUM(l.credits_charged) AS total_credits_spent,
    SUM(l.credits_charged) FILTER (WHERE l.occurred_at >= (NOW() - INTERVAL '7 days')) AS credits_last_7d,
    SUM(l.credits_charged) FILTER (WHERE l.occurred_at >= (NOW() - INTERVAL '30 days')) AS credits_last_30d,
    SUM(l.quantity) FILTER (WHERE l.metric_type = 'impression' AND l.occurred_at >= (NOW() - INTERVAL '7 days')) AS impressions_last_7d,
    SUM(l.quantity) FILTER (WHERE l.metric_type = 'click' AND l.occurred_at >= (NOW() - INTERVAL '7 days')) AS clicks_last_7d,
    MAX(l.occurred_at) AS last_spend_at
  FROM campaigns.ad_spend_ledger l
  GROUP BY l.campaign_id
),
delivery_events AS (
  SELECT
    i.campaign_id,
    MAX(i.created_at) AS last_impression_at,
    COUNT(*) FILTER (WHERE i.created_at >= (NOW() - INTERVAL '7 days')) AS impressions_events_7d
  FROM campaigns.ad_impressions i
  GROUP BY i.campaign_id
),
click_events AS (
  SELECT
    c.campaign_id,
    MAX(c.created_at) AS last_click_at,
    COUNT(*) FILTER (WHERE c.created_at >= (NOW() - INTERVAL '7 days')) AS clicks_events_7d
  FROM campaigns.ad_clicks c
  GROUP BY c.campaign_id
)
SELECT
  base.id,
  base.org_id,
  base.created_by,
  base.name,
  base.description,
  base.objective,
  base.status,
  base.total_budget_credits,
  base.daily_budget_credits,
  COALESCE(ledger.total_credits_spent, base.spent_credits) AS spent_credits,
  base.start_date,
  base.end_date,
  base.timezone,
  base.pacing_strategy,
  base.frequency_cap_per_user,
  base.frequency_cap_period,
  base.created_at,
  base.updated_at,
  base.archived_at,
  COALESCE(creative.total_creatives, 0) AS total_creatives,
  COALESCE(creative.active_creatives, 0) AS active_creatives,
  ledger.credits_last_7d,
  ledger.credits_last_30d,
  ledger.impressions_last_7d,
  ledger.clicks_last_7d,
  COALESCE(delivery.last_impression_at, ledger.last_spend_at, base.updated_at) AS last_activity_at,
  delivery.last_impression_at,
  click_evt.last_click_at,
  -- Delivery status logic
  CASE
    WHEN base.status IN ('archived', 'completed') THEN base.status::TEXT
    WHEN COALESCE(creative.active_creatives, 0) = 0 THEN 'no-creatives'
    WHEN base.start_date > NOW() THEN 'scheduled'
    WHEN base.end_date IS NOT NULL AND base.end_date < NOW() THEN 'completed'
    WHEN COALESCE(ledger.credits_last_7d, 0) = 0 AND base.status = 'active' THEN 'at-risk'
    ELSE base.status::TEXT
  END AS delivery_status,
  -- Pacing health logic
  CASE
    WHEN base.status IN ('archived', 'completed') THEN 'complete'
    WHEN COALESCE(ledger.credits_last_7d, 0) = 0 THEN 'stalled'
    WHEN base.daily_budget_credits IS NOT NULL 
      AND COALESCE(ledger.credits_last_7d, 0) < base.daily_budget_credits * 2 THEN 'slow'
    WHEN base.daily_budget_credits IS NOT NULL 
      AND COALESCE(ledger.credits_last_7d, 0) > base.daily_budget_credits * 9 THEN 'accelerating'
    ELSE 'on-track'
  END AS pacing_health
FROM campaigns.campaigns base
LEFT JOIN creative_counts creative ON creative.campaign_id = base.id
LEFT JOIN ledger_totals ledger ON ledger.campaign_id = base.id
LEFT JOIN delivery_events delivery ON delivery.campaign_id = base.id
LEFT JOIN click_events click_evt ON click_evt.campaign_id = base.id;

-- Grant permissions
GRANT SELECT ON public.campaigns_overview TO authenticated;
GRANT SELECT ON public.campaigns_overview TO service_role;

-- Add descriptive comment
COMMENT ON VIEW public.campaigns_overview IS 
  'Campaign overview with delivery metrics, pacing intelligence, and 7-day performance data. 
   Security: Inherits RLS from campaigns.campaigns - users see only campaigns for orgs they belong to.';

-- ================================================================
-- Performance Indexes
-- ================================================================

-- Optimize ad_spend_ledger queries (campaign + time range)
CREATE INDEX IF NOT EXISTS idx_ad_spend_ledger_campaign_occurred 
  ON campaigns.ad_spend_ledger(campaign_id, occurred_at DESC);

-- Optimize ad_impressions queries (campaign + time range)
CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign_created 
  ON campaigns.ad_impressions(campaign_id, created_at DESC);

-- Optimize ad_clicks queries (campaign + time range)
CREATE INDEX IF NOT EXISTS idx_ad_clicks_campaign_created 
  ON campaigns.ad_clicks(campaign_id, created_at DESC);

-- Optimize ad_creatives queries (campaign + active status)
CREATE INDEX IF NOT EXISTS idx_ad_creatives_campaign_active
  ON campaigns.ad_creatives(campaign_id, active) 
  WHERE active = TRUE;

-- ================================================================
-- Done! Campaigns overview view now available at public.campaigns_overview
-- ================================================================






