-- ============================================================
-- Create Public Views for Non-Public Schema Tables
-- ============================================================
-- Purpose: Expose messaging, organizations, and campaigns tables
--          via public schema views for PostgREST API access
-- ============================================================

-- Drop existing views first (if they exist with wrong columns)
DROP VIEW IF EXISTS public.message_jobs CASCADE;
DROP VIEW IF EXISTS public.org_contact_imports CASCADE;
DROP VIEW IF EXISTS public.org_contact_import_entries CASCADE;
DROP VIEW IF EXISTS public.credit_packages CASCADE;
DROP VIEW IF EXISTS public.ad_creatives CASCADE;
DROP VIEW IF EXISTS public.payout_accounts CASCADE;

-- 1. Messaging Schema Views
-- ============================================================

-- Message Jobs View
CREATE VIEW public.message_jobs AS
SELECT 
  id,
  event_id,
  channel,
  template_id,
  subject,
  body,
  sms_body,
  from_name,
  from_email,
  status,
  batch_size,
  scheduled_at,
  created_by,
  created_at,
  reply_to
FROM messaging.message_jobs;

COMMENT ON VIEW public.message_jobs IS 'Public view of messaging.message_jobs for API access';

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_jobs TO authenticated;
GRANT SELECT ON public.message_jobs TO anon;

-- Enable RLS on the underlying table (if not already enabled)
ALTER TABLE messaging.message_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see message jobs for events they organize
CREATE POLICY "Users can view message jobs for their events"
  ON messaging.message_jobs
  FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events.events 
      WHERE created_by = auth.uid()
        OR owner_context_id IN (
          SELECT org_id FROM organizations.org_memberships 
          WHERE user_id = auth.uid()
        )
    )
  );

-- RLS Policy: Users can create message jobs for their events
CREATE POLICY "Users can create message jobs for their events"
  ON messaging.message_jobs
  FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT id FROM events.events 
      WHERE created_by = auth.uid()
        OR owner_context_id IN (
          SELECT org_id FROM organizations.org_memberships 
          WHERE user_id = auth.uid()
        )
    )
  );

-- ============================================================
-- 2. Organizations Schema Views
-- ============================================================

-- Org Contact Imports View
CREATE VIEW public.org_contact_imports AS
SELECT 
  id,
  org_id,
  name,
  source,
  imported_by,
  imported_at,
  original_row_count,
  metadata
FROM organizations.org_contact_imports;

COMMENT ON VIEW public.org_contact_imports IS 'Public view of organizations.org_contact_imports for API access';

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_contact_imports TO authenticated;

-- Enable RLS
ALTER TABLE organizations.org_contact_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see imports for orgs they're members of
CREATE POLICY "Users can view org contact imports"
  ON organizations.org_contact_imports
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organizations.org_memberships 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can create imports for their orgs
CREATE POLICY "Users can create org contact imports"
  ON organizations.org_contact_imports
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organizations.org_memberships 
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Org Contact Import Entries View
CREATE OR REPLACE VIEW public.org_contact_import_entries AS
SELECT 
  id,
  import_id,
  full_name,
  email,
  phone,
  tags,
  consent,
  metadata,
  created_at
FROM organizations.org_contact_import_entries;

COMMENT ON VIEW public.org_contact_import_entries IS 'Public view of organizations.org_contact_import_entries for API access';

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_contact_import_entries TO authenticated;

-- Enable RLS
ALTER TABLE organizations.org_contact_import_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see entries for imports they have access to
CREATE POLICY "Users can view org contact import entries"
  ON organizations.org_contact_import_entries
  FOR SELECT
  USING (
    import_id IN (
      SELECT id FROM organizations.org_contact_imports
      WHERE org_id IN (
        SELECT org_id FROM organizations.org_memberships 
        WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 3. Campaigns Schema Views
-- ============================================================

-- Credit Packages View
CREATE VIEW public.credit_packages AS
SELECT 
  id,
  name,
  credits,
  price_usd_cents,
  is_default,
  is_active,
  sort_order,
  created_at,
  updated_at
FROM campaigns.credit_packages;

COMMENT ON VIEW public.credit_packages IS 'Public view of campaigns.credit_packages for API access';

-- Grant access (read-only for most users)
GRANT SELECT ON public.credit_packages TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.credit_packages TO service_role;

-- No RLS needed - credit packages are public info
-- (The actual table might not need RLS since it's product catalog)

-- Ad Creatives View (limited fields for security)
CREATE OR REPLACE VIEW public.ad_creatives AS
SELECT 
  id,
  campaign_id,
  headline,
  body_text,
  cta_label,
  cta_url,
  media_type,
  media_url,
  post_id,
  poster_url,
  active,
  created_at,
  updated_at
FROM campaigns.ad_creatives;

COMMENT ON VIEW public.ad_creatives IS 'Public view of campaigns.ad_creatives for API access';

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_creatives TO authenticated;

-- Enable RLS
ALTER TABLE campaigns.ad_creatives ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can see creatives for their campaigns
CREATE POLICY "Users can view their ad creatives"
  ON campaigns.ad_creatives
  FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM campaigns.campaigns
      WHERE org_id IN (
        SELECT org_id FROM organizations.org_memberships 
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policy: Users can create creatives for their campaigns
CREATE POLICY "Users can create ad creatives"
  ON campaigns.ad_creatives
  FOR INSERT
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns.campaigns
      WHERE org_id IN (
        SELECT org_id FROM organizations.org_memberships 
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'editor')
      )
    )
  );

-- Payout Accounts View
CREATE VIEW public.payout_accounts AS
SELECT 
  id,
  context_type,
  context_id,
  stripe_connect_id,
  charges_enabled,
  payouts_enabled,
  details_submitted,
  created_at
FROM organizations.payout_accounts;

COMMENT ON VIEW public.payout_accounts IS 'Public view of organizations.payout_accounts for API access';

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_accounts TO authenticated;

-- Enable RLS
ALTER TABLE organizations.payout_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view payout accounts for their organizations
CREATE POLICY "Users can view their payout accounts"
  ON organizations.payout_accounts
  FOR SELECT
  USING (
    (context_type = 'organization' AND context_id IN (
      SELECT org_id FROM organizations.org_memberships 
      WHERE user_id = auth.uid()
    ))
    OR
    (context_type = 'individual' AND context_id = auth.uid())
  );

-- RLS Policy: Users can create payout accounts for their organizations
CREATE POLICY "Users can create payout accounts"
  ON organizations.payout_accounts
  FOR INSERT
  WITH CHECK (
    (context_type = 'organization' AND context_id IN (
      SELECT org_id FROM organizations.org_memberships 
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    ))
    OR
    (context_type = 'individual' AND context_id = auth.uid())
  );

-- ============================================================
-- 4. Update Frontend Code to Use Public Views
-- ============================================================
-- After running this migration:
-- 1. Remove .schema() calls from frontend code
-- 2. Use: .from('message_jobs') instead of .schema('messaging').from('message_jobs')
-- 3. Views will handle the routing to correct schema
-- ============================================================

-- ============================================================
-- 5. Performance Indexes (if not already on base tables)
-- ============================================================

-- Ensure indexes exist on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_message_jobs_event_id 
  ON messaging.message_jobs(event_id);

CREATE INDEX IF NOT EXISTS idx_message_jobs_status 
  ON messaging.message_jobs(status);

CREATE INDEX IF NOT EXISTS idx_org_contact_imports_org_id 
  ON organizations.org_contact_imports(org_id);

CREATE INDEX IF NOT EXISTS idx_org_contact_import_entries_import_id 
  ON organizations.org_contact_import_entries(import_id);

CREATE INDEX IF NOT EXISTS idx_credit_packages_is_active_sort 
  ON campaigns.credit_packages(is_active, sort_order) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ad_creatives_campaign_id 
  ON campaigns.ad_creatives(campaign_id);

CREATE INDEX IF NOT EXISTS idx_payout_accounts_context 
  ON organizations.payout_accounts(context_type, context_id);

CREATE INDEX IF NOT EXISTS idx_payout_accounts_stripe_connect 
  ON organizations.payout_accounts(stripe_connect_id);

-- ============================================================
-- Done! Tables now accessible via public schema views
-- ============================================================

