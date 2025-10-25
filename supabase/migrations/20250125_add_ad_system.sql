-- =====================================================
-- Ad Serving System - Phase 1
-- =====================================================
-- This migration adds:
-- 1. Ad pricing matrix table (category-specific CPM/CPC rates)
-- 2. Platform maturity settings
-- 3. Campaign pricing model and targeting columns
-- 4. SQL function to select eligible ads for serving
-- =====================================================

-- =====================================================
-- 1. Ad Pricing Matrix Table
-- =====================================================

CREATE TABLE IF NOT EXISTS campaigns.ad_pricing_matrix (
  category TEXT PRIMARY KEY,
  cpm_startup DECIMAL(10, 2) NOT NULL,
  cpm_mature DECIMAL(10, 2) NOT NULL,
  cpc_startup DECIMAL(10, 2) NOT NULL,
  cpc_mature DECIMAL(10, 2) NOT NULL,
  ctr_pct DECIMAL(5, 2) NOT NULL,
  cpa_startup DECIMAL(10, 2) NOT NULL,
  cpa_mature DECIMAL(10, 2) NOT NULL,
  est_impr_per_1k_startup INTEGER NOT NULL,
  est_clicks_per_1k_startup INTEGER NOT NULL,
  est_impr_per_1k_mature INTEGER NOT NULL,
  est_clicks_per_1k_mature INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE campaigns.ad_pricing_matrix OWNER TO postgres;

COMMENT ON TABLE campaigns.ad_pricing_matrix IS 'Category-specific ad pricing model (startup → mature TikTok-level rates)';

-- =====================================================
-- 2. Seed Ad Pricing Matrix Data
-- =====================================================

INSERT INTO campaigns.ad_pricing_matrix (
  category,
  cpm_startup, cpm_mature,
  cpc_startup, cpc_mature,
  ctr_pct,
  cpa_startup, cpa_mature,
  est_impr_per_1k_startup, est_clicks_per_1k_startup,
  est_impr_per_1k_mature, est_clicks_per_1k_mature,
  notes
) VALUES
  ('Music', 2.00, 8.00, 0.25, 1.00, 3.0, 5.00, 20.00, 500000, 15000, 125000, 3750, 'High discovery demand; steady engagement'),
  ('Sports', 2.50, 9.00, 0.30, 1.20, 2.5, 6.00, 22.00, 400000, 10000, 111000, 2775, 'Strong local audience but seasonal'),
  ('Comedy', 1.80, 7.00, 0.20, 0.90, 3.5, 4.00, 18.00, 555000, 19000, 143000, 5000, 'High shareability; great for short clips'),
  ('Food', 1.50, 6.00, 0.18, 0.80, 3.8, 3.00, 15.00, 666000, 25000, 166000, 6300, 'Lower barrier, strong visual content'),
  ('Conference', 3.00, 10.00, 0.40, 1.50, 2.0, 8.00, 25.00, 333000, 6600, 100000, 2000, 'Niche but high-value conversions'),
  ('Art', 1.70, 7.00, 0.22, 0.90, 3.2, 4.00, 18.00, 588000, 18000, 143000, 4575, 'Creative appeal, strong visual storytelling'),
  ('Nightlife', 2.20, 9.00, 0.28, 1.20, 2.8, 5.00, 22.00, 454000, 12700, 111000, 3100, 'Premium weekend/event demand')
ON CONFLICT (category) DO UPDATE SET
  cpm_startup = EXCLUDED.cpm_startup,
  cpm_mature = EXCLUDED.cpm_mature,
  cpc_startup = EXCLUDED.cpc_startup,
  cpc_mature = EXCLUDED.cpc_mature,
  ctr_pct = EXCLUDED.ctr_pct,
  cpa_startup = EXCLUDED.cpa_startup,
  cpa_mature = EXCLUDED.cpa_mature,
  est_impr_per_1k_startup = EXCLUDED.est_impr_per_1k_startup,
  est_clicks_per_1k_startup = EXCLUDED.est_clicks_per_1k_startup,
  est_impr_per_1k_mature = EXCLUDED.est_impr_per_1k_mature,
  est_clicks_per_1k_mature = EXCLUDED.est_clicks_per_1k_mature,
  notes = EXCLUDED.notes,
  updated_at = now();

-- =====================================================
-- 3. Platform Maturity Settings
-- =====================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.platform_settings OWNER TO postgres;

-- Set initial platform maturity to 0.01 (1% - early startup)
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'platform_maturity_score',
  '{"score": 0.01, "dau": 1000, "target_dau": 100000}'::jsonb,
  'Platform maturity score (0.0 = startup, 1.0 = mature). Used for dynamic ad pricing interpolation.'
) ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 4. Add Columns to Campaigns Table
-- =====================================================

-- Add pricing model (cpm, cpc, cpa)
ALTER TABLE campaigns.campaigns 
ADD COLUMN IF NOT EXISTS pricing_model TEXT DEFAULT 'cpm' CHECK (pricing_model IN ('cpm', 'cpc', 'cpa'));

-- Update existing campaigns to have default pricing model
UPDATE campaigns.campaigns 
SET pricing_model = 'cpm' 
WHERE pricing_model IS NULL;

COMMENT ON COLUMN campaigns.campaigns.pricing_model IS 'Pricing model: cpm (per 1k impressions), cpc (per click), or cpa (per acquisition)';

-- NOTE: campaign_targeting table already exists with categories, locations, keywords columns
-- We will use that table instead of adding duplicate columns to campaigns

-- =====================================================
-- 5. Helper Function: Calculate Dynamic CPM/CPC
-- =====================================================

CREATE OR REPLACE FUNCTION campaigns.calculate_ad_rate(
  p_category TEXT,
  p_pricing_model TEXT DEFAULT 'cpm'
)
RETURNS DECIMAL
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_maturity_score DECIMAL;
  v_startup_rate DECIMAL;
  v_mature_rate DECIMAL;
  v_interpolated_rate DECIMAL;
BEGIN
  -- Get platform maturity score
  SELECT (value->>'score')::DECIMAL 
  INTO v_maturity_score
  FROM public.platform_settings
  WHERE key = 'platform_maturity_score';
  
  -- Default to startup if not set
  IF v_maturity_score IS NULL THEN
    v_maturity_score := 0.01;
  END IF;
  
  -- Get rates from pricing matrix
  IF p_pricing_model = 'cpm' THEN
    SELECT cpm_startup, cpm_mature
    INTO v_startup_rate, v_mature_rate
    FROM campaigns.ad_pricing_matrix
    WHERE category = p_category;
  ELSIF p_pricing_model = 'cpc' THEN
    SELECT cpc_startup, cpc_mature
    INTO v_startup_rate, v_mature_rate
    FROM campaigns.ad_pricing_matrix
    WHERE category = p_category;
  ELSIF p_pricing_model = 'cpa' THEN
    SELECT cpa_startup, cpa_mature
    INTO v_startup_rate, v_mature_rate
    FROM campaigns.ad_pricing_matrix
    WHERE category = p_category;
  ELSE
    RAISE EXCEPTION 'Invalid pricing model: %', p_pricing_model;
  END IF;
  
  -- If category not found, use Music as default
  IF v_startup_rate IS NULL THEN
    SELECT cpm_startup, cpm_mature
    INTO v_startup_rate, v_mature_rate
    FROM campaigns.ad_pricing_matrix
    WHERE category = 'Music';
  END IF;
  
  -- Interpolate: startup_rate + (mature_rate - startup_rate) * maturity_score
  v_interpolated_rate := v_startup_rate + (v_mature_rate - v_startup_rate) * v_maturity_score;
  
  RETURN v_interpolated_rate;
END;
$$;

ALTER FUNCTION campaigns.calculate_ad_rate(TEXT, TEXT) OWNER TO postgres;

COMMENT ON FUNCTION campaigns.calculate_ad_rate(TEXT, TEXT) IS 'Calculate dynamic ad rate based on category and platform maturity (interpolates startup → mature)';

GRANT EXECUTE ON FUNCTION campaigns.calculate_ad_rate(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION campaigns.calculate_ad_rate(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION campaigns.calculate_ad_rate(TEXT, TEXT) TO service_role;

-- =====================================================
-- 6. Function: Select Eligible Ads for Feed
-- =====================================================

CREATE OR REPLACE FUNCTION campaigns.get_eligible_ads(
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_placement TEXT DEFAULT 'feed',
  p_category TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  campaign_id UUID,
  creative_id UUID,
  event_id UUID,
  org_id UUID,
  org_name TEXT,
  event_title TEXT,
  event_description TEXT,
  event_cover_image TEXT,
  event_start_at TIMESTAMPTZ,
  event_venue TEXT,
  event_category TEXT,
  pricing_model TEXT,
  estimated_rate DECIMAL,
  priority_score DECIMAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH active_campaigns AS (
    SELECT 
      c.id AS campaign_id,
      c.org_id,
      c.pricing_model,
      ct.categories AS target_categories,
      ct.locations AS target_locations,
      ct.keywords AS target_keywords,
      c.total_budget_credits,
      c.spent_credits,
      c.daily_budget_credits,
      c.start_date,
      c.end_date,
      -- Calculate remaining budget
      (c.total_budget_credits - COALESCE(c.spent_credits, 0)) AS remaining_budget
    FROM campaigns.campaigns c
    LEFT JOIN campaigns.campaign_targeting ct ON ct.campaign_id = c.id
    WHERE 
      c.status::text = 'active'
      AND c.start_date <= now()
      AND (c.end_date IS NULL OR c.end_date >= now())
      -- Must have budget remaining
      AND (c.total_budget_credits - COALESCE(c.spent_credits, 0)) > 0
  ),
  eligible_creatives AS (
    SELECT
      ac.campaign_id,
      cr.id AS creative_id,
      posts.event_id AS event_id,
      ac.org_id,
      ac.pricing_model,
      ac.remaining_budget,
      ac.target_categories,
      ac.target_locations,
      ac.target_keywords
    FROM active_campaigns ac
    INNER JOIN campaigns.ad_creatives cr ON cr.campaign_id = ac.campaign_id
    INNER JOIN events.event_posts posts ON posts.id = cr.post_id
    WHERE 
      cr.active = true
      AND cr.post_id IS NOT NULL
      AND posts.event_id IS NOT NULL
      -- Check if placement is targeted
      AND EXISTS (
        SELECT 1 
        FROM campaigns.campaign_placements cp
        WHERE cp.campaign_id = ac.campaign_id
        AND cp.placement = p_placement::public.ad_placement
        AND cp.enabled = true
      )
  ),
  matched_ads AS (
    SELECT
      ec.campaign_id,
      ec.creative_id,
      ec.event_id,
      ec.org_id,
      ec.pricing_model,
      ec.remaining_budget,
      e.title AS event_title,
      e.description AS event_description,
      e.cover_image_url AS event_cover_image,
      e.start_at AS event_start_at,
      e.venue AS event_venue,
      e.category AS event_category,
      o.name AS org_name,
      -- Calculate priority score
      (
        -- Budget weight (40%): More budget = higher priority
        (LEAST(ec.remaining_budget / 1000.0, 10) * 0.4) +
        -- Category match (30%): Exact match boosts priority
        (CASE 
          WHEN p_category IS NOT NULL AND ec.target_categories IS NOT NULL 
            AND p_category = ANY(ec.target_categories) THEN 0.3
          WHEN p_category IS NULL OR ec.target_categories IS NULL THEN 0.15
          ELSE 0.0
        END) +
        -- Location match (20%): Exact match boosts priority
        (CASE 
          WHEN p_location IS NOT NULL AND ec.target_locations IS NOT NULL 
            AND ec.target_locations::text ILIKE '%' || p_location || '%' THEN 0.2
          WHEN p_location IS NULL OR ec.target_locations IS NULL THEN 0.1
          ELSE 0.0
        END) +
        -- Randomness (10%): Prevent same ads always winning
        (random() * 0.1)
      ) AS priority_score
    FROM eligible_creatives ec
    INNER JOIN events.events e ON e.id = ec.event_id
    INNER JOIN organizations.organizations o ON o.id = ec.org_id
    WHERE
      -- Event ID must exist (from join with event_posts)
      ec.event_id IS NOT NULL
      -- Event must be in the future
      AND e.start_at > now()
      -- Apply category filter if provided
      AND (p_category IS NULL OR ec.target_categories IS NULL OR p_category = ANY(ec.target_categories))
      -- Apply location filter if provided (locations is JSONB, so we use text search)
      AND (p_location IS NULL OR ec.target_locations IS NULL OR ec.target_locations::text ILIKE '%' || p_location || '%')
  )
  SELECT
    ma.campaign_id,
    ma.creative_id,
    ma.event_id,
    ma.org_id,
    ma.org_name,
    ma.event_title,
    ma.event_description,
    ma.event_cover_image,
    ma.event_start_at,
    ma.event_venue,
    ma.event_category,
    ma.pricing_model,
    campaigns.calculate_ad_rate(ma.event_category, ma.pricing_model) AS estimated_rate,
    ma.priority_score
  FROM matched_ads ma
  ORDER BY ma.priority_score DESC, random()
  LIMIT p_limit;
END;
$$;

ALTER FUNCTION campaigns.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) OWNER TO postgres;

COMMENT ON FUNCTION campaigns.get_eligible_ads IS 'Select eligible ads for serving based on targeting, budget, and priority';

-- Grant schema access for the function
GRANT USAGE ON SCHEMA events TO postgres;
GRANT USAGE ON SCHEMA organizations TO postgres;
GRANT USAGE ON SCHEMA campaigns TO postgres;

-- Grant table access
GRANT SELECT ON events.event_posts TO postgres;
GRANT SELECT ON events.events TO postgres;
GRANT SELECT ON organizations.organizations TO postgres;

GRANT EXECUTE ON FUNCTION campaigns.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION campaigns.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION campaigns.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

-- =====================================================
-- 7. Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_campaigns_active_status 
ON campaigns.campaigns(status, start_date, end_date) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ad_creatives_active 
ON campaigns.ad_creatives(campaign_id, active) 
WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_campaign_placements_active 
ON campaigns.campaign_placements(campaign_id, placement, enabled) 
WHERE enabled = true;

-- =====================================================
-- 8. RLS Policies for Pricing Matrix
-- =====================================================

ALTER TABLE campaigns.ad_pricing_matrix ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read pricing matrix
CREATE POLICY "pricing_matrix_read_all" ON campaigns.ad_pricing_matrix
  FOR SELECT TO authenticated, anon
  USING (true);

-- Only service role can modify pricing matrix
CREATE POLICY "pricing_matrix_admin_only" ON campaigns.ad_pricing_matrix
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 9. Grant Permissions
-- =====================================================

GRANT SELECT ON campaigns.ad_pricing_matrix TO authenticated;
GRANT SELECT ON campaigns.ad_pricing_matrix TO anon;
GRANT ALL ON campaigns.ad_pricing_matrix TO service_role;

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT SELECT ON public.platform_settings TO anon;
GRANT ALL ON public.platform_settings TO service_role;

-- =====================================================
-- Done!
-- =====================================================

