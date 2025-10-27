-- =====================================================
-- Ad Tracking: Deduplication, Viewability & Attribution
-- =====================================================
-- Implements:
-- 1. Server-side impression deduplication (hour bucket)
-- 2. Viewability tracking (IAB standard: 50% visible for 1s)
-- 3. Click deduplication (minute bucket)
-- 4. Last-click 7d + 1-day view attribution
-- 5. Request-level idempotency
-- =====================================================

-- =====================================================
-- 1. ad_impressions: Add dedup + viewability fields
-- =====================================================

-- Add viewability and tracking fields
ALTER TABLE campaigns.ad_impressions
  ADD COLUMN IF NOT EXISTS hour_bucket TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pct_visible NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS dwell_ms INTEGER,
  ADD COLUMN IF NOT EXISTS viewable BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS request_id UUID;

COMMENT ON COLUMN campaigns.ad_impressions.hour_bucket IS 'Hour truncation of created_at for deduplication (populated by trigger)';
COMMENT ON COLUMN campaigns.ad_impressions.pct_visible IS 'Percentage of ad visible in viewport (0-100)';
COMMENT ON COLUMN campaigns.ad_impressions.dwell_ms IS 'Time ad was visible in milliseconds';
COMMENT ON COLUMN campaigns.ad_impressions.viewable IS 'IAB viewability: >=50% visible for >=1000ms';
COMMENT ON COLUMN campaigns.ad_impressions.request_id IS 'Client request ID for idempotency';

-- Trigger to populate hour_bucket on insert/update
CREATE OR REPLACE FUNCTION campaigns.set_impression_hour_bucket()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hour_bucket := date_trunc('hour', NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP TRIGGER IF EXISTS trg_set_impression_hour_bucket ON campaigns.ad_impressions;
CREATE TRIGGER trg_set_impression_hour_bucket
  BEFORE INSERT OR UPDATE OF created_at ON campaigns.ad_impressions
  FOR EACH ROW
  EXECUTE FUNCTION campaigns.set_impression_hour_bucket();

-- Backfill existing rows
UPDATE campaigns.ad_impressions
SET hour_bucket = date_trunc('hour', created_at)
WHERE hour_bucket IS NULL;

-- Prevent exact dupes within hour (same session/campaign/creative/placement)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_impressions_dedup
ON campaigns.ad_impressions (
  campaign_id, 
  creative_id, 
  session_id, 
  placement, 
  hour_bucket
);

-- Optional: guard by request ID (idempotency across retries)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_impressions_request_dedup
ON campaigns.ad_impressions (request_id) WHERE request_id IS NOT NULL;

-- Performance: frequency cap lookups
CREATE INDEX IF NOT EXISTS idx_ad_impressions_freq_cap_user
ON campaigns.ad_impressions (campaign_id, user_id, created_at DESC)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ad_impressions_freq_cap_session
ON campaigns.ad_impressions (campaign_id, session_id, created_at DESC)
WHERE session_id IS NOT NULL;

-- =====================================================
-- 2. ad_clicks: Add dedup + anti-fraud fields
-- =====================================================

ALTER TABLE campaigns.ad_clicks
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS minute_bucket TIMESTAMPTZ;

COMMENT ON COLUMN campaigns.ad_clicks.request_id IS 'Client request ID for idempotency';
COMMENT ON COLUMN campaigns.ad_clicks.ip_address IS 'IP address for light fraud detection';
COMMENT ON COLUMN campaigns.ad_clicks.user_agent IS 'User agent for light fraud detection';
COMMENT ON COLUMN campaigns.ad_clicks.minute_bucket IS 'Minute truncation of clicked_at for deduplication (populated by trigger)';

-- Trigger to populate minute_bucket on insert/update
CREATE OR REPLACE FUNCTION campaigns.set_click_minute_bucket()
RETURNS TRIGGER AS $$
BEGIN
  NEW.minute_bucket := date_trunc('minute', NEW.clicked_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DROP TRIGGER IF EXISTS trg_set_click_minute_bucket ON campaigns.ad_clicks;
CREATE TRIGGER trg_set_click_minute_bucket
  BEFORE INSERT OR UPDATE OF clicked_at ON campaigns.ad_clicks
  FOR EACH ROW
  EXECUTE FUNCTION campaigns.set_click_minute_bucket();

-- Backfill existing rows
UPDATE campaigns.ad_clicks
SET minute_bucket = date_trunc('minute', clicked_at)
WHERE minute_bucket IS NULL;

-- One click per impression per session per minute
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_clicks_dedup
ON campaigns.ad_clicks (
  impression_id, 
  session_id, 
  minute_bucket
)
WHERE impression_id IS NOT NULL AND session_id IS NOT NULL;

-- Request-level idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_clicks_request_dedup
ON campaigns.ad_clicks (request_id) WHERE request_id IS NOT NULL;

-- Performance: attribution lookups
CREATE INDEX IF NOT EXISTS idx_ad_clicks_user_time
ON campaigns.ad_clicks (user_id, clicked_at DESC)
WHERE user_id IS NOT NULL;

-- =====================================================
-- 3. ad_conversions: Enhance for attribution tracking
-- =====================================================

-- Add missing columns if table already exists, or create fresh
DO $$ 
BEGIN
  -- Check if table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'campaigns' AND tablename = 'ad_conversions'
  ) THEN
    -- Create fresh table
    CREATE TABLE campaigns.ad_conversions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      click_id UUID REFERENCES campaigns.ad_clicks(id),
      impression_id UUID REFERENCES campaigns.ad_impressions(id),
      user_id UUID,
      session_id TEXT,
      kind TEXT NOT NULL DEFAULT 'purchase' CHECK (kind IN ('purchase', 'signup', 'other')),
      value_cents INTEGER NOT NULL DEFAULT 0,
      ticket_id UUID,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      request_id UUID,
      CONSTRAINT ad_conv_click_or_impression_chk CHECK (
        click_id IS NOT NULL OR impression_id IS NOT NULL
      )
    );
    
    ALTER TABLE campaigns.ad_conversions OWNER TO postgres;
  ELSE
    -- Table exists, add missing columns
    ALTER TABLE campaigns.ad_conversions
      ADD COLUMN IF NOT EXISTS user_id UUID,
      ADD COLUMN IF NOT EXISTS impression_id UUID REFERENCES campaigns.ad_impressions(id),
      ADD COLUMN IF NOT EXISTS session_id TEXT,
      ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'purchase',
      ADD COLUMN IF NOT EXISTS value_cents INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ticket_id UUID,
      ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS request_id UUID;
    
    -- Add check constraint if it doesn't exist
    ALTER TABLE campaigns.ad_conversions
      DROP CONSTRAINT IF EXISTS ad_conv_click_or_impression_chk;
    
    ALTER TABLE campaigns.ad_conversions
      ADD CONSTRAINT ad_conv_click_or_impression_chk CHECK (
        click_id IS NOT NULL OR impression_id IS NOT NULL
      );
      
    -- Add kind constraint if it doesn't exist
    ALTER TABLE campaigns.ad_conversions
      DROP CONSTRAINT IF EXISTS ad_conversions_kind_check;
      
    ALTER TABLE campaigns.ad_conversions
      ADD CONSTRAINT ad_conversions_kind_check CHECK (kind IN ('purchase', 'signup', 'other'));
  END IF;
END $$;

COMMENT ON TABLE campaigns.ad_conversions IS 'Conversion tracking with last-click or view-through attribution';
COMMENT ON COLUMN campaigns.ad_conversions.click_id IS 'Last click within 7 days (preferred attribution)';
COMMENT ON COLUMN campaigns.ad_conversions.impression_id IS 'Last impression within 1 day (view-through)';
COMMENT ON COLUMN campaigns.ad_conversions.kind IS 'Type of conversion: purchase, signup, other';
COMMENT ON COLUMN campaigns.ad_conversions.value_cents IS 'Conversion value in cents';

-- =====================================================
-- 3b. Ad Spend Ledger (for billing audit trail)
-- =====================================================

CREATE TABLE IF NOT EXISTS campaigns.ad_spend_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns.campaigns(id) ON DELETE CASCADE,
  creative_id UUID REFERENCES campaigns.ad_creatives(id) ON DELETE SET NULL,
  metric_type TEXT NOT NULL, -- 'impression', 'click', 'conversion'
  quantity INTEGER NOT NULL DEFAULT 1,
  rate_model TEXT NOT NULL, -- 'cpm', 'cpc', 'cpa'
  credits_charged INTEGER NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_spend_campaign_time
ON campaigns.ad_spend_ledger (campaign_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_spend_creative
ON campaigns.ad_spend_ledger (creative_id);

COMMENT ON TABLE campaigns.ad_spend_ledger IS 'Audit trail of all ad spend charges';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_ad_conversions_user_time
ON campaigns.ad_conversions (user_id, occurred_at DESC)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ad_conversions_click
ON campaigns.ad_conversions (click_id)
WHERE click_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ad_conversions_impression
ON campaigns.ad_conversions (impression_id)
WHERE impression_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_conversions_request_dedup
ON campaigns.ad_conversions (request_id)
WHERE request_id IS NOT NULL;

-- =====================================================
-- 4. Server Function: log_impression_and_charge (CPM)
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_impression_and_charge(
  p_campaign_id UUID,
  p_creative_id UUID,
  p_user_id UUID,
  p_session_id TEXT,
  p_placement public.ad_placement,
  p_pricing_model TEXT,             -- 'cpm' | 'cpc'
  p_rate_credits INTEGER,           -- credits per 1k impressions (CPM) or per click (CPC)
  p_request_id UUID,
  p_pct_visible NUMERIC DEFAULT NULL,
  p_dwell_ms INTEGER DEFAULT NULL,
  p_viewable BOOLEAN DEFAULT false,
  p_freq_cap_per_day INTEGER DEFAULT NULL
) 
RETURNS TABLE(impression_id UUID, charged_credits INTEGER) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_today TIMESTAMPTZ := date_trunc('day', NOW());
  v_count INTEGER;
  v_charge INTEGER := 0;
  v_new_impression_id UUID;
BEGIN
  -- Server-side frequency cap check
  IF p_freq_cap_per_day IS NOT NULL AND p_freq_cap_per_day > 0 THEN
    SELECT COUNT(*) INTO v_count
    FROM campaigns.ad_impressions
    WHERE campaign_id = p_campaign_id
      AND (
        (p_user_id IS NOT NULL AND user_id = p_user_id) OR
        (p_session_id IS NOT NULL AND session_id = p_session_id)
      )
      AND created_at >= v_today;
    
    IF v_count >= p_freq_cap_per_day THEN
      RAISE EXCEPTION 'frequency_cap_exceeded: User has seen % impressions today (limit: %)', v_count, p_freq_cap_per_day;
    END IF;
  END IF;

  -- Insert impression (dedup by unique index)
  INSERT INTO campaigns.ad_impressions(
    id, campaign_id, creative_id, user_id, session_id, placement,
    created_at, pct_visible, dwell_ms, viewable, request_id
  )
  VALUES (
    gen_random_uuid(), p_campaign_id, p_creative_id, p_user_id,
    p_session_id, p_placement, NOW(), p_pct_visible, p_dwell_ms,
    p_viewable, p_request_id
  )
  ON CONFLICT (campaign_id, creative_id, session_id, placement, hour_bucket) DO NOTHING
  RETURNING id INTO v_new_impression_id;

  -- If dedup blocked insert, fetch existing impression ID
  IF v_new_impression_id IS NULL THEN
    SELECT id INTO v_new_impression_id
    FROM campaigns.ad_impressions
    WHERE campaign_id = p_campaign_id
      AND creative_id = p_creative_id
      AND session_id = p_session_id
      AND placement = p_placement
      AND hour_bucket = date_trunc('hour', NOW())
    LIMIT 1;
    
    -- Return existing impression without charging again
    RETURN QUERY SELECT v_new_impression_id, 0;
    RETURN;
  END IF;

  -- Billing: CPM charges at impression time (1/1000th of rate per impression)
  IF p_pricing_model = 'cpm' AND p_rate_credits > 0 THEN
    v_charge := CEIL(p_rate_credits::NUMERIC / 1000.0);
    
    INSERT INTO campaigns.ad_spend_ledger (
      campaign_id, creative_id, metric_type, quantity, 
      rate_model, credits_charged, occurred_at
    )
    VALUES (
      p_campaign_id, p_creative_id, 'impression', 1,
      'cpm', v_charge, NOW()
    );
    
    -- Update campaign spent_credits
    UPDATE campaigns.campaigns
    SET spent_credits = COALESCE(spent_credits, 0) + v_charge
    WHERE id = p_campaign_id;
  END IF;

  RETURN QUERY SELECT v_new_impression_id, v_charge;
END $$;

COMMENT ON FUNCTION public.log_impression_and_charge IS 
  'Logs ad impression with server-side deduplication and frequency capping. Charges CPM campaigns.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_impression_and_charge TO service_role;
GRANT EXECUTE ON FUNCTION public.log_impression_and_charge TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_impression_and_charge TO anon;

-- =====================================================
-- 5. Server Function: log_click_and_charge (CPC)
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_click_and_charge(
  p_impression_id UUID,
  p_campaign_id UUID,
  p_creative_id UUID,
  p_user_id UUID,
  p_session_id TEXT,
  p_pricing_model TEXT,    -- 'cpm' | 'cpc'
  p_bid_credits INTEGER,   -- CPC bid in credits
  p_request_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) 
RETURNS TABLE(click_id UUID, charged_credits INTEGER) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_new_click_id UUID;
  v_charge INTEGER := 0;
  v_campaign_id UUID;
  v_existing_click_id UUID;
BEGIN
  -- 1) Check request_id idempotency first (if provided)
  IF p_request_id IS NOT NULL THEN
    SELECT id INTO v_existing_click_id
    FROM campaigns.ad_clicks
    WHERE request_id = p_request_id
    LIMIT 1;
    
    IF FOUND THEN
      -- Return existing click, no charge (idempotent retry)
      RETURN QUERY SELECT v_existing_click_id, 0;
      RETURN;
    END IF;
  END IF;

  -- 2) Best-effort: find recent impression if not provided
  IF p_impression_id IS NULL AND p_campaign_id IS NOT NULL THEN
    SELECT id INTO p_impression_id
    FROM campaigns.ad_impressions
    WHERE campaign_id = p_campaign_id
      AND (user_id = p_user_id OR session_id = p_session_id)
      AND created_at >= NOW() - INTERVAL '30 minutes'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- 3) Insert click (dedup by unique index on impression+session+minute)
  -- Note: If impression_id is NULL, dedup by request_id instead
  INSERT INTO campaigns.ad_clicks(
    id, impression_id, campaign_id, creative_id, user_id, session_id,
    clicked_at, request_id, ip_address, user_agent
  )
  VALUES (
    gen_random_uuid(), p_impression_id, p_campaign_id, p_creative_id,
    p_user_id, p_session_id, NOW(), p_request_id, p_ip_address, p_user_agent
  )
  ON CONFLICT (request_id) WHERE request_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_new_click_id;

  -- If dedup blocked insert, fetch existing click ID
  IF v_new_click_id IS NULL THEN
    SELECT id INTO v_new_click_id
    FROM campaigns.ad_clicks
    WHERE impression_id = p_impression_id
      AND session_id = p_session_id
      AND minute_bucket = date_trunc('minute', NOW())
    LIMIT 1;
    
    -- Return existing click without charging again (duplicate within same minute)
    RETURN QUERY SELECT v_new_click_id, 0;
    RETURN;
  END IF;

  -- Get campaign_id from impression if not provided
  IF p_campaign_id IS NULL THEN
    SELECT campaign_id INTO v_campaign_id
    FROM campaigns.ad_impressions WHERE id = p_impression_id;
  ELSE
    v_campaign_id := p_campaign_id;
  END IF;

  -- Billing: CPC charges per click
  IF p_pricing_model = 'cpc' AND p_bid_credits > 0 THEN
    v_charge := p_bid_credits;
    
    INSERT INTO campaigns.ad_spend_ledger (
      campaign_id, creative_id, metric_type, quantity,
      rate_model, credits_charged, occurred_at
    )
    VALUES (
      v_campaign_id, p_creative_id, 'click', 1,
      'cpc', v_charge, NOW()
    );
    
    -- Update campaign spent_credits
    UPDATE campaigns.campaigns
    SET spent_credits = COALESCE(spent_credits, 0) + v_charge
    WHERE id = v_campaign_id;
  END IF;

  RETURN QUERY SELECT v_new_click_id, v_charge;
END $$;

COMMENT ON FUNCTION public.log_click_and_charge IS 
  'Logs ad click with server-side deduplication. Charges CPC campaigns.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_click_and_charge TO service_role;
GRANT EXECUTE ON FUNCTION public.log_click_and_charge TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_click_and_charge TO anon;

-- =====================================================
-- 6. Attribution Function: Last-click 7d → 1-day view
-- =====================================================

CREATE OR REPLACE FUNCTION public.attribute_conversion(
  p_user_id UUID,
  p_session_id TEXT DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW(),
  p_value_cents INTEGER DEFAULT 0,
  p_kind TEXT DEFAULT 'purchase',
  p_ticket_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
) 
RETURNS TABLE(
  conversion_id UUID, 
  click_id UUID, 
  impression_id UUID,
  attribution_model TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_click_id UUID;
  v_impression_id UUID;
  v_conversion_id UUID;
  v_attribution TEXT;
BEGIN
  -- Last-click attribution (7 days)
  SELECT c.id, i.id INTO v_click_id, v_impression_id
  FROM campaigns.ad_clicks c
  JOIN campaigns.ad_impressions i ON i.id = c.impression_id
  WHERE c.user_id = p_user_id 
    AND c.clicked_at >= p_occurred_at - INTERVAL '7 days'
    AND c.clicked_at <= p_occurred_at
  ORDER BY c.clicked_at DESC 
  LIMIT 1;

  IF v_click_id IS NOT NULL THEN
    v_attribution := 'last_click_7d';
  ELSE
    -- View-through attribution (1 day)
    SELECT i.id INTO v_impression_id
    FROM campaigns.ad_impressions i
    WHERE i.user_id = p_user_id
      AND i.created_at >= p_occurred_at - INTERVAL '1 day'
      AND i.created_at <= p_occurred_at
      AND i.viewable = true  -- Only count viewable impressions
    ORDER BY i.created_at DESC
    LIMIT 1;
    
    IF v_impression_id IS NOT NULL THEN
      v_attribution := 'view_through_1d';
    ELSE
      v_attribution := 'none';
    END IF;
  END IF;

  -- Insert conversion record (if attribution found)
  IF v_click_id IS NOT NULL OR v_impression_id IS NOT NULL THEN
    INSERT INTO campaigns.ad_conversions (
      id, click_id, impression_id, user_id, session_id,
      kind, value_cents, ticket_id, occurred_at, request_id
    )
    VALUES (
      gen_random_uuid(), v_click_id, v_impression_id, p_user_id, p_session_id,
      p_kind, p_value_cents, p_ticket_id, p_occurred_at, p_request_id
    )
    ON CONFLICT ON CONSTRAINT idx_ad_conversions_request_dedup DO NOTHING
    RETURNING id INTO v_conversion_id;
  END IF;

  RETURN QUERY SELECT v_conversion_id, v_click_id, v_impression_id, v_attribution;
END $$;

COMMENT ON FUNCTION public.attribute_conversion IS 
  'Attributes conversion to last click (7d) or view-through impression (1d). Returns attribution model used.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.attribute_conversion TO authenticated, service_role;

-- =====================================================
-- Done! Phase 1 complete.
-- =====================================================

