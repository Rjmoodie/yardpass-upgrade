-- =====================================================================
-- AUDIENCE INTELLIGENCE - SCHEMA & FOUNDATION
-- Migration: 20251112000005_audience_intelligence_schema.sql
-- =====================================================================
-- Transforms Audience tab into complete growth intelligence platform
-- Adds segmentation, quality metrics, retention, pathing, activation
-- =====================================================================

-- =====================================================================
-- 1. ENHANCE analytics.events WITH ACQUISITION & DEVICE DATA
-- =====================================================================

-- Add UTM columns for easier querying (denormalized from utm JSONB)
ALTER TABLE analytics.events
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT;

-- Add device columns (denormalized from device JSONB)
ALTER TABLE analytics.events
  ADD COLUMN IF NOT EXISTS device_type TEXT,  -- mobile/desktop/tablet
  ADD COLUMN IF NOT EXISTS device_os TEXT,     -- ios/android/macos/windows
  ADD COLUMN IF NOT EXISTS device_browser TEXT; -- chrome/safari/firefox

-- Add network quality
ALTER TABLE analytics.events
  ADD COLUMN IF NOT EXISTS network_type TEXT;  -- wifi/4g/3g/5g/unknown

-- Add page performance
ALTER TABLE analytics.events
  ADD COLUMN IF NOT EXISTS page_load_ms INTEGER;

-- Create indexes on new columns
CREATE INDEX IF NOT EXISTS idx_events_utm_source ON analytics.events(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_device_type ON analytics.events(device_type) WHERE device_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_network_type ON analytics.events(network_type) WHERE network_type IS NOT NULL;

-- Update trigger to auto-populate denormalized columns from JSONB
CREATE OR REPLACE FUNCTION analytics.populate_event_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Extract UTM from JSONB
  NEW.utm_source := NEW.utm->>'source';
  NEW.utm_medium := NEW.utm->>'medium';
  NEW.utm_campaign := NEW.utm->>'campaign';
  NEW.utm_term := NEW.utm->>'term';
  NEW.utm_content := NEW.utm->>'content';
  
  -- Extract device from JSONB
  NEW.device_type := NEW.device->>'type';
  NEW.device_os := NEW.device->>'os';
  NEW.device_browser := NEW.device->>'browser';
  
  -- Extract page load if exists
  NEW.page_load_ms := (NEW.props->>'page_load_ms')::INTEGER;
  
  RETURN NEW;
END;
$$;

-- Only create trigger if table is not partitioned
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'populate_event_columns_trigger'
  ) THEN
    CREATE TRIGGER populate_event_columns_trigger
      BEFORE INSERT ON analytics.events
      FOR EACH ROW
      EXECUTE FUNCTION analytics.populate_event_columns();
  END IF;
END $$;

COMMENT ON FUNCTION analytics.populate_event_columns IS 
  'Auto-populates denormalized columns from JSONB for faster queries.';

-- =====================================================================
-- 2. AUDIENCE CUSTOMERS TABLE (Buyer-Centric View)
-- =====================================================================

CREATE TABLE IF NOT EXISTS analytics.audience_customers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID,  -- Primary org they buy from (can be NULL for multi-org buyers)
  
  -- Lifecycle timestamps
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  first_order_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,
  
  -- Purchase behavior
  orders_count INTEGER DEFAULT 0,
  gross_cents BIGINT DEFAULT 0,
  net_cents BIGINT DEFAULT 0,  -- After refunds
  
  -- Engagement
  events_viewed INTEGER DEFAULT 0,
  posts_viewed INTEGER DEFAULT 0,
  avg_session_duration_sec INTEGER,
  
  -- Acquisition
  first_touch_source TEXT,
  first_touch_medium TEXT,
  last_touch_source TEXT,
  
  -- Device preference
  primary_device TEXT,  -- Most common device
  
  -- Computed scores
  propensity_score INTEGER DEFAULT 0,  -- 0-10 score for likelihood to purchase
  lifecycle_stage TEXT CHECK (lifecycle_stage IN (
    'prospect',      -- Viewed but never purchased
    'customer',      -- 1 purchase
    'repeat_buyer',  -- 2-3 purchases
    'champion',      -- 4+ purchases or high engagement
    'at_risk',       -- No activity 60+ days
    'churned'        -- No activity 180+ days
  )),
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON analytics.audience_customers(org_id, lifecycle_stage);
CREATE INDEX ON analytics.audience_customers(first_touch_source);
CREATE INDEX ON analytics.audience_customers(propensity_score DESC);
CREATE INDEX ON analytics.audience_customers(last_order_at DESC NULLS LAST);
CREATE INDEX ON analytics.audience_customers(lifecycle_stage, updated_at DESC);

COMMENT ON TABLE analytics.audience_customers IS 
  'Buyer-centric customer view with lifecycle stages, propensity scores, and engagement metrics.';

GRANT SELECT ON analytics.audience_customers TO authenticated;
GRANT ALL ON analytics.audience_customers TO service_role;

-- RLS: Users see customers for their orgs
ALTER TABLE analytics.audience_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customers for their orgs"
  ON analytics.audience_customers
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL
    OR EXISTS (
      SELECT 1 FROM organizations.org_memberships om
      WHERE om.org_id = analytics.audience_customers.org_id
        AND om.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 3. AUDIENCE SEGMENTS (Segmentation Engine)
-- =====================================================================

CREATE TABLE IF NOT EXISTS analytics.audience_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  
  -- Segment metadata
  name TEXT NOT NULL,
  description TEXT,
  
  -- Segment definition (flexible JSONB filter)
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  /* Example:
  {
    "utm_source": "instagram",
    "device_type": "mobile",
    "not_purchased": true,
    "viewed_events": {"min": 2},
    "propensity_score": {"min": 7}
  }
  */
  
  -- Size tracking
  size_estimate INTEGER DEFAULT 0,
  last_size_check TIMESTAMPTZ,
  
  -- Usage
  export_count INTEGER DEFAULT 0,
  last_exported_at TIMESTAMPTZ,
  campaign_count INTEGER DEFAULT 0,  -- How many campaigns used this
  
  -- Access control
  created_by UUID REFERENCES auth.users(id),
  is_shared BOOLEAN DEFAULT FALSE,  -- Share with org team
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_segment_name_per_org UNIQUE (org_id, name)
);

CREATE INDEX ON analytics.audience_segments(org_id, created_at DESC);
CREATE INDEX ON analytics.audience_segments(created_by);
CREATE INDEX ON analytics.audience_segments(size_estimate DESC);
CREATE INDEX ON analytics.audience_segments USING GIN(definition);

COMMENT ON TABLE analytics.audience_segments IS 
  'Saved audience segments for targeting, retargeting, and campaign activation.';

GRANT SELECT, INSERT, UPDATE, DELETE ON analytics.audience_segments TO authenticated;
GRANT ALL ON analytics.audience_segments TO service_role;

-- RLS
ALTER TABLE analytics.audience_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage segments for their orgs"
  ON analytics.audience_segments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations.org_memberships om
      WHERE om.org_id = analytics.audience_segments.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations.org_memberships om
      WHERE om.org_id = analytics.audience_segments.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- =====================================================================
-- 4. SEGMENT EXPORT LOG (Privacy & Compliance)
-- =====================================================================

CREATE TABLE IF NOT EXISTS analytics.segment_export_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID REFERENCES analytics.audience_segments(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  
  -- Who exported
  exported_by UUID REFERENCES auth.users(id),
  
  -- What was exported
  user_count INTEGER NOT NULL,
  included_pii BOOLEAN DEFAULT FALSE,  -- Did export include emails/phones?
  export_format TEXT CHECK (export_format IN ('csv', 'json', 'api')),
  
  -- Purpose (optional)
  purpose TEXT,  -- 'email_campaign', 'retargeting', 'analysis'
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  exported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON analytics.segment_export_log(segment_id, exported_at DESC);
CREATE INDEX ON analytics.segment_export_log(org_id, exported_at DESC);
CREATE INDEX ON analytics.segment_export_log(exported_by, exported_at DESC);

COMMENT ON TABLE analytics.segment_export_log IS 
  'Audit log for segment exports. Tracks who exported what for compliance.';

GRANT SELECT ON analytics.segment_export_log TO authenticated;
GRANT INSERT ON analytics.segment_export_log TO authenticated, service_role;
GRANT ALL ON analytics.segment_export_log TO service_role;

-- RLS
ALTER TABLE analytics.segment_export_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view export logs for their orgs"
  ON analytics.segment_export_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations.org_memberships om
      WHERE om.org_id = analytics.segment_export_log.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can insert export logs"
  ON analytics.segment_export_log
  FOR INSERT
  TO authenticated
  WITH CHECK (exported_by = auth.uid());

-- =====================================================================
-- MIGRATION COMPLETE - AUDIENCE INTELLIGENCE SCHEMA
-- =====================================================================

-- Summary:
-- ✅ Enhanced analytics.events with UTM and device columns
-- ✅ audience_customers table for buyer lifecycle tracking
-- ✅ audience_segments table for segmentation engine
-- ✅ segment_export_log for compliance and audit
-- ✅ Auto-populate trigger for denormalized columns
-- ✅ Indexes for fast queries
-- ✅ RLS policies for security
--
-- Next: Create RPC functions for audience intelligence

