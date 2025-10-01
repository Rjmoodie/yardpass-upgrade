-- Ad Campaigns System Schema

-- Campaign status enum
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed', 'archived');

-- Campaign objective enum
CREATE TYPE campaign_objective AS ENUM ('ticket_sales', 'brand_awareness', 'engagement', 'event_promotion');

-- Ad placement enum
CREATE TYPE ad_placement AS ENUM ('feed', 'story', 'event_banner', 'search_results');

-- Pacing & period enums (adding upfront)
CREATE TYPE pacing_strategy AS ENUM ('even','accelerated');
CREATE TYPE frequency_period AS ENUM ('session','day','week');
CREATE TYPE creative_media_type AS ENUM ('image','video','existing_post');

-- Campaigns table
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  objective campaign_objective NOT NULL DEFAULT 'ticket_sales',
  status campaign_status NOT NULL DEFAULT 'draft',
  
  -- Budget
  total_budget_credits INTEGER NOT NULL,
  daily_budget_credits INTEGER,
  spent_credits INTEGER NOT NULL DEFAULT 0,
  
  -- Schedule
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  
  -- Pacing (using enums)
  pacing_strategy pacing_strategy NOT NULL DEFAULT 'even',
  frequency_cap_per_user INTEGER DEFAULT 3,
  frequency_cap_period frequency_period DEFAULT 'day',
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT campaigns_budget_nonneg_chk CHECK (total_budget_credits >= 0 AND (daily_budget_credits IS NULL OR daily_budget_credits >= 0)),
  CONSTRAINT campaigns_daily_le_total_chk CHECK (daily_budget_credits IS NULL OR daily_budget_credits <= total_budget_credits),
  CONSTRAINT campaigns_spent_le_total_chk CHECK (spent_credits >= 0 AND spent_credits <= total_budget_credits),
  CONSTRAINT campaigns_valid_dates_chk CHECK (end_date IS NULL OR end_date > start_date),
  CONSTRAINT campaigns_freq_cap_chk CHECK (frequency_cap_per_user IS NULL OR frequency_cap_per_user > 0)
);

-- Ad Creatives table
CREATE TABLE ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Content
  headline TEXT NOT NULL,
  body_text TEXT,
  cta_label TEXT NOT NULL DEFAULT 'Learn More',
  cta_url TEXT,
  
  -- Media (using enum)
  media_type creative_media_type NOT NULL,
  media_url TEXT,
  post_id UUID REFERENCES event_posts(id),
  poster_url TEXT,
  
  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT ad_creatives_cta_len_chk CHECK (cta_label IS NULL OR length(cta_label) BETWEEN 1 AND 24)
);

-- Campaign Targeting table
CREATE TABLE campaign_targeting (
  campaign_id UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Geographic
  locations JSONB DEFAULT '[]'::jsonb,
  
  -- Demographics & Interests
  categories TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  
  -- Behavioral
  exclude_ticket_holders BOOLEAN DEFAULT false,
  exclude_past_attendees BOOLEAN DEFAULT false,
  
  -- Audience size estimate
  estimated_reach INTEGER,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign Placements table
CREATE TABLE campaign_placements (
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  placement ad_placement NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (campaign_id, placement)
);

-- Ad Impressions table
CREATE TABLE ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID,
  session_id TEXT,
  placement ad_placement NOT NULL,
  
  -- Context
  event_id UUID REFERENCES events(id),
  post_id UUID REFERENCES event_posts(id),
  
  -- Metadata
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT ad_impressions_session_or_user_chk CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Ad Clicks table
CREATE TABLE ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  impression_id UUID REFERENCES ad_impressions(id),
  user_id UUID,
  session_id TEXT,
  
  -- Conversion tracking
  converted BOOLEAN DEFAULT false,
  conversion_value_cents INTEGER,
  ticket_id UUID REFERENCES tickets(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT ad_clicks_impression_or_session_chk CHECK (impression_id IS NOT NULL OR session_id IS NOT NULL)
);

-- Campaign Analytics Materialized View (corrected)
CREATE MATERIALIZED VIEW campaign_analytics_daily AS
WITH days AS (
  SELECT c.id AS campaign_id,
         c.org_id,
         gs::date AS date
  FROM campaigns c
  CROSS JOIN generate_series(date_trunc('day', c.start_date)::date,
                             COALESCE(date_trunc('day', c.end_date), now())::date,
                             interval '1 day') gs
),
imp AS (
  SELECT campaign_id,
         date_trunc('day', created_at)::date AS date,
         COUNT(*) AS impressions,
         COUNT(DISTINCT user_id) AS unique_users,
         COUNT(DISTINCT session_id) AS unique_sessions
  FROM ad_impressions
  GROUP BY 1,2
),
clk AS (
  SELECT campaign_id,
         date_trunc('day', created_at)::date AS date,
         COUNT(*) AS clicks,
         COUNT(*) FILTER (WHERE converted) AS conversions,
         COALESCE(SUM(conversion_value_cents) FILTER (WHERE converted),0) AS revenue_cents
  FROM ad_clicks
  GROUP BY 1,2
),
spend AS (
  SELECT campaign_id,
         date_trunc('day', occurred_at)::date AS date,
         COALESCE(SUM(credits_charged),0) AS credits_spent
  FROM ad_spend_ledger
  GROUP BY 1,2
)
SELECT d.campaign_id,
       d.org_id,
       d.date,
       COALESCE(imp.impressions,0) AS impressions,
       COALESCE(imp.unique_users,0) AS unique_users,
       COALESCE(imp.unique_sessions,0) AS unique_sessions,
       COALESCE(clk.clicks,0) AS clicks,
       COALESCE(clk.conversions,0) AS conversions,
       COALESCE(clk.revenue_cents,0) AS revenue_cents,
       COALESCE(spend.credits_spent,0) AS credits_spent
FROM days d
LEFT JOIN imp   ON imp.campaign_id = d.campaign_id AND imp.date = d.date
LEFT JOIN clk   ON clk.campaign_id = d.campaign_id AND clk.date = d.date
LEFT JOIN spend ON spend.campaign_id = d.campaign_id AND spend.date = d.date;

-- Indexes
CREATE INDEX idx_campaigns_org_status_dates ON campaigns (org_id, status, start_date, end_date);
CREATE INDEX idx_campaign_placements_enabled ON campaign_placements (campaign_id, placement) WHERE enabled = true;
CREATE INDEX idx_ad_creatives_campaign_active ON ad_creatives (campaign_id, active);
CREATE INDEX idx_ad_impressions_campaign_created ON ad_impressions (campaign_id, created_at DESC);
CREATE INDEX idx_ad_clicks_campaign_created ON ad_clicks (campaign_id, created_at DESC);
CREATE INDEX idx_ad_impressions_user_session ON ad_impressions (user_id, session_id, campaign_id, created_at DESC);
CREATE INDEX idx_ad_clicks_impression ON ad_clicks (impression_id);
CREATE INDEX idx_mv_campaign_analytics_daily_key ON campaign_analytics_daily (campaign_id, date);

-- Service role helper
CREATE OR REPLACE FUNCTION public.is_service_role() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') = 'service'
$$;

-- RLS Policies
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_targeting ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_clicks ENABLE ROW LEVEL SECURITY;

-- Campaigns policies
CREATE POLICY campaigns_select_org_member ON campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = campaigns.org_id AND user_id = auth.uid()
    )
  );

CREATE POLICY campaigns_insert_org_editor ON campaigns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = campaigns.org_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY campaigns_update_org_editor ON campaigns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_id = campaigns.org_id 
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor')
    )
  );

-- Ad Creatives policies
CREATE POLICY ad_creatives_select ON ad_creatives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN org_memberships om ON om.org_id = c.org_id
      WHERE c.id = ad_creatives.campaign_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY ad_creatives_manage ON ad_creatives
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN org_memberships om ON om.org_id = c.org_id
      WHERE c.id = ad_creatives.campaign_id 
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'editor')
    )
  );

-- Campaign Targeting policies
CREATE POLICY campaign_targeting_select ON campaign_targeting
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN org_memberships om ON om.org_id = c.org_id
      WHERE c.id = campaign_targeting.campaign_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY campaign_targeting_manage ON campaign_targeting
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN org_memberships om ON om.org_id = c.org_id
      WHERE c.id = campaign_targeting.campaign_id 
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'editor')
    )
  );

-- Campaign Placements policies
CREATE POLICY campaign_placements_select ON campaign_placements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN org_memberships om ON om.org_id = c.org_id
      WHERE c.id = campaign_placements.campaign_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY campaign_placements_manage ON campaign_placements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN org_memberships om ON om.org_id = c.org_id
      WHERE c.id = campaign_placements.campaign_id 
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'editor')
    )
  );

-- Ad Impressions policies (service role only for insert)
CREATE POLICY ad_impressions_select ON ad_impressions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN org_memberships om ON om.org_id = c.org_id
      WHERE c.id = ad_impressions.campaign_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY ad_impressions_insert_service ON ad_impressions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_service_role());

-- Ad Clicks policies (service role only for insert)
CREATE POLICY ad_clicks_select ON ad_clicks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN org_memberships om ON om.org_id = c.org_id
      WHERE c.id = ad_clicks.campaign_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY ad_clicks_insert_service ON ad_clicks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_service_role());

-- Triggers
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION tg_touch_updated_at();

CREATE TRIGGER ad_creatives_updated_at BEFORE UPDATE ON ad_creatives
  FOR EACH ROW EXECUTE FUNCTION tg_touch_updated_at();

CREATE TRIGGER campaign_targeting_updated_at BEFORE UPDATE ON campaign_targeting
  FOR EACH ROW EXECUTE FUNCTION tg_touch_updated_at();