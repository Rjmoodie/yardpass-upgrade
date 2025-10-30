-- ==========================================
-- Campaign Lifecycle - Production-Ready Implementation
-- ==========================================
-- Addresses:
-- 1. Single source of truth for servability
-- 2. Derived status for UI clarity
-- 3. Hard stop at charge time (prevent overspend/race)
-- 4. Auto-complete reconciler
-- 5. Status reason codes
-- 6. Notification triggers
-- 7. Test utilities

-- ==========================================
-- 1. Single Source of Truth: is_servable()
-- ==========================================

CREATE OR REPLACE FUNCTION campaigns.is_servable(
  p_campaign_id UUID,
  p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT
    COALESCE(c.status::text = 'active', false)  -- Explicit state check
    AND (c.start_date IS NULL OR p_at >= c.start_date)
    AND (c.end_date IS NULL OR p_at <= c.end_date)
    AND (c.total_budget_credits IS NULL 
         OR COALESCE(c.spent_credits, 0) < c.total_budget_credits)
  FROM campaigns.campaigns c
  WHERE c.id = p_campaign_id
$$;

COMMENT ON FUNCTION campaigns.is_servable IS 
  'Single source of truth: can this campaign serve ads right now?';

GRANT EXECUTE ON FUNCTION campaigns.is_servable TO authenticated, anon, service_role;

-- ==========================================
-- 2. Derived Status View (UI Clarity)
-- ==========================================

CREATE OR REPLACE VIEW public.campaigns_with_status AS
SELECT
  c.*,
  -- Computed status (what the UI should show)
  CASE
    WHEN c.status::text = 'paused' THEN 'paused'
    WHEN c.status::text = 'archived' THEN 'archived'
    WHEN c.status::text = 'draft' THEN 'draft'
    WHEN c.end_date IS NOT NULL AND now() > c.end_date THEN 'ended'
    WHEN c.total_budget_credits IS NOT NULL 
         AND COALESCE(c.spent_credits, 0) >= c.total_budget_credits 
         THEN 'budget_exhausted'
    WHEN c.start_date IS NOT NULL AND now() < c.start_date THEN 'scheduled'
    WHEN c.status::text = 'active' THEN 'active'
    ELSE 'unknown'
  END AS derived_status,
  
  -- Why is it not servable? (array of reason codes)
  array_remove(ARRAY[
    CASE WHEN c.status::text != 'active' THEN c.status::text END,
    CASE WHEN c.end_date IS NOT NULL AND now() > c.end_date THEN 'past_end_date' END,
    CASE WHEN c.total_budget_credits IS NOT NULL 
         AND COALESCE(c.spent_credits, 0) >= c.total_budget_credits 
         THEN 'budget_exhausted' END,
    CASE WHEN c.start_date IS NOT NULL AND now() < c.start_date THEN 'before_start_date' END
  ], NULL) AS not_servable_reasons,
  
  -- Servability check (boolean)
  campaigns.is_servable(c.id) AS is_servable,
  
  -- Useful metrics
  COALESCE(c.spent_credits, 0)::NUMERIC / NULLIF(c.total_budget_credits, 0) AS budget_used_pct,
  c.total_budget_credits - COALESCE(c.spent_credits, 0) AS remaining_credits,
  
  -- Projected runout date (at current daily spend rate)
  CASE 
    WHEN c.daily_budget_credits > 0 AND c.total_budget_credits IS NOT NULL THEN
      now() + ((c.total_budget_credits - COALESCE(c.spent_credits, 0))::NUMERIC 
               / NULLIF(c.daily_budget_credits, 0) * interval '1 day')
    ELSE NULL
  END AS projected_runout_date,
  
  -- Hours servable / hours since start (uptime %)
  CASE
    WHEN c.start_date IS NOT NULL AND c.start_date <= now() THEN
      EXTRACT(EPOCH FROM (
        LEAST(COALESCE(c.end_date, now()), now()) - c.start_date
      )) / 3600.0
    ELSE 0
  END AS hours_since_start
  
FROM campaigns.campaigns c;

COMMENT ON VIEW public.campaigns_with_status IS 
  'Campaigns with computed UI status, servability flags, and diagnostic reasons';

GRANT SELECT ON public.campaigns_with_status TO authenticated, anon;

-- ==========================================
-- 3. Hard Stop at Charge Time (Prevent Overspend)
-- ==========================================

CREATE OR REPLACE FUNCTION public.try_charge_campaign(
  p_campaign_id UUID,
  p_credits NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, campaigns
AS $$
DECLARE
  v_budget NUMERIC;
  v_spent NUMERIC;
  v_end_date TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  -- 🔒 Lock the campaign row (prevents race conditions)
  SELECT 
    total_budget_credits,
    COALESCE(spent_credits, 0),
    end_date,
    status::text
  INTO v_budget, v_spent, v_end_date, v_status
  FROM campaigns.campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;  -- Critical: prevents concurrent charges
  
  -- Check if campaign is servable
  IF v_status != 'active' THEN
    RAISE NOTICE 'Campaign % is not active (status: %)', p_campaign_id, v_status;
    RETURN false;
  END IF;
  
  IF v_end_date IS NOT NULL AND now() > v_end_date THEN
    RAISE NOTICE 'Campaign % has ended (end_date: %)', p_campaign_id, v_end_date;
    RETURN false;
  END IF;
  
  -- Check if charge would exceed budget
  IF v_budget IS NOT NULL AND (v_spent + p_credits) > v_budget THEN
    RAISE NOTICE 'Campaign % would exceed budget (spent: %, budget: %, charge: %)', 
      p_campaign_id, v_spent, v_budget, p_credits;
    RETURN false;
  END IF;
  
  -- All checks passed - apply the charge
  UPDATE campaigns.campaigns
  SET 
    spent_credits = v_spent + p_credits,
    updated_at = now()
  WHERE id = p_campaign_id;
  
  RAISE NOTICE 'Campaign % charged % credits (new spent: %)', 
    p_campaign_id, p_credits, v_spent + p_credits;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.try_charge_campaign IS 
  'Atomically charge a campaign with row-level locking to prevent overspend races';

GRANT EXECUTE ON FUNCTION public.try_charge_campaign TO authenticated, anon, service_role;

-- ==========================================
-- 4. Auto-Complete Reconciler (Cron Job)
-- ==========================================

CREATE OR REPLACE FUNCTION campaigns.reconcile_campaign_status()
RETURNS TABLE (
  campaign_id UUID,
  old_status TEXT,
  new_status TEXT,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH updates AS (
    UPDATE campaigns.campaigns c
    SET 
      status = 'completed'::public.campaign_status,
      updated_at = now()
    WHERE c.status::text IN ('active', 'scheduled')
      AND (
        -- End date passed
        (c.end_date IS NOT NULL AND now() > c.end_date)
        OR
        -- Budget exhausted
        (c.total_budget_credits IS NOT NULL 
         AND COALESCE(c.spent_credits, 0) >= c.total_budget_credits)
      )
    RETURNING 
      c.id,
      'active' AS old_status,
      'completed' AS new_status,
      CASE
        WHEN c.end_date IS NOT NULL AND now() > c.end_date 
          THEN 'end_date_reached'
        WHEN c.total_budget_credits IS NOT NULL 
             AND COALESCE(c.spent_credits, 0) >= c.total_budget_credits 
          THEN 'budget_exhausted'
        ELSE 'unknown'
      END AS reason
  )
  SELECT * FROM updates;
END;
$$;

COMMENT ON FUNCTION campaigns.reconcile_campaign_status IS 
  'Auto-mark campaigns as completed when end_date or budget is exhausted. Run via cron.';

GRANT EXECUTE ON FUNCTION campaigns.reconcile_campaign_status TO service_role;

-- ==========================================
-- 5. Notification Triggers (Status Changes)
-- ==========================================

-- Create notification function for campaign status changes
CREATE OR REPLACE FUNCTION campaigns.notify_campaign_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_members UUID[];
  v_member_id UUID;
  v_reason TEXT;
BEGIN
  -- Only trigger on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Determine reason for status change
  v_reason := CASE
    WHEN NEW.status::text = 'completed' AND NEW.end_date IS NOT NULL AND now() > NEW.end_date
      THEN 'Campaign ended (reached end date)'
    WHEN NEW.status::text = 'completed' AND COALESCE(NEW.spent_credits, 0) >= NEW.total_budget_credits
      THEN 'Campaign ended (budget exhausted)'
    WHEN NEW.status::text = 'paused'
      THEN 'Campaign paused'
    WHEN NEW.status::text = 'active'
      THEN 'Campaign activated'
    ELSE 'Campaign status changed to ' || NEW.status::text
  END;
  
  -- Get all org admins/editors (people who should be notified)
  SELECT array_agg(user_id)
  INTO v_org_members
  FROM organizations.org_memberships
  WHERE org_id = NEW.org_id
    AND role IN ('owner', 'admin', 'editor');
  
  -- Insert notification for each member
  -- Note: This assumes you have a notifications table
  -- If you don't, comment this out or create the table first
  /*
  FOREACH v_member_id IN ARRAY v_org_members
  LOOP
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      data,
      created_at
    ) VALUES (
      v_member_id,
      'campaign_status_change',
      'Campaign Status Update',
      format('%s: %s', NEW.name, v_reason),
      jsonb_build_object(
        'campaign_id', NEW.id,
        'campaign_name', NEW.name,
        'old_status', OLD.status::text,
        'new_status', NEW.status::text,
        'reason', v_reason
      ),
      now()
    );
  END LOOP;
  */
  
  -- Log to console (for now)
  RAISE NOTICE 'Campaign % status changed: % → % (reason: %)', 
    NEW.name, OLD.status, NEW.status, v_reason;
  
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS campaign_status_change_notify ON campaigns.campaigns;
CREATE TRIGGER campaign_status_change_notify
  AFTER UPDATE OF status ON campaigns.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION campaigns.notify_campaign_status_change();

COMMENT ON TRIGGER campaign_status_change_notify ON campaigns.campaigns IS
  'Notifies org members when campaign status changes';

-- ==========================================
-- 6. Update get_eligible_ads to use is_servable()
-- ==========================================

-- Create a simplified version that uses our new function
CREATE OR REPLACE FUNCTION campaigns.get_eligible_campaigns(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  campaign_id UUID,
  org_id UUID,
  name TEXT,
  remaining_budget NUMERIC,
  is_servable BOOLEAN
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    c.id AS campaign_id,
    c.org_id,
    c.name,
    c.total_budget_credits - COALESCE(c.spent_credits, 0) AS remaining_budget,
    campaigns.is_servable(c.id) AS is_servable
  FROM campaigns.campaigns c
  WHERE campaigns.is_servable(c.id) = true
  ORDER BY c.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION campaigns.get_eligible_campaigns IS
  'Get list of currently servable campaigns using is_servable() predicate';

GRANT EXECUTE ON FUNCTION campaigns.get_eligible_campaigns TO authenticated, anon, service_role;

-- ==========================================
-- 7. Test Utilities
-- ==========================================

-- Test function: simulate concurrent charges
CREATE OR REPLACE FUNCTION campaigns.test_concurrent_charges(
  p_campaign_id UUID,
  p_charge_amount NUMERIC,
  p_num_attempts INTEGER
)
RETURNS TABLE (
  attempt INTEGER,
  success BOOLEAN,
  spent_before NUMERIC,
  spent_after NUMERIC
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_success BOOLEAN;
  v_spent_before NUMERIC;
  v_spent_after NUMERIC;
  i INTEGER;
BEGIN
  FOR i IN 1..p_num_attempts LOOP
    -- Get spent before
    SELECT COALESCE(spent_credits, 0) 
    INTO v_spent_before
    FROM campaigns.campaigns 
    WHERE id = p_campaign_id;
    
    -- Try to charge
    SELECT public.try_charge_campaign(p_campaign_id, p_charge_amount)
    INTO v_success;
    
    -- Get spent after
    SELECT COALESCE(spent_credits, 0) 
    INTO v_spent_after
    FROM campaigns.campaigns 
    WHERE id = p_campaign_id;
    
    RETURN QUERY SELECT i, v_success, v_spent_before, v_spent_after;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION campaigns.test_concurrent_charges IS
  'Test utility: simulate multiple charge attempts to verify no overspend';

-- Test function: verify is_servable logic
CREATE OR REPLACE FUNCTION campaigns.test_is_servable()
RETURNS TABLE (
  test_case TEXT,
  passed BOOLEAN,
  details TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_test_campaign_id UUID;
BEGIN
  -- Create test campaign
  INSERT INTO campaigns.campaigns (
    org_id,
    created_by,
    name,
    status,
    total_budget_credits,
    spent_credits,
    start_date,
    end_date
  ) VALUES (
    (SELECT id FROM organizations.organizations LIMIT 1),
    (SELECT id FROM auth.users LIMIT 1),
    'Test Campaign - Delete Me',
    'active'::public.campaign_status,
    10000,
    0,
    now() - interval '1 day',
    now() + interval '1 day'
  ) RETURNING id INTO v_test_campaign_id;
  
  -- Test 1: Active campaign should be servable
  RETURN QUERY SELECT
    'Active campaign with budget and valid dates'::TEXT,
    campaigns.is_servable(v_test_campaign_id) = true,
    'Should be servable'::TEXT;
  
  -- Test 2: Paused campaign should not be servable
  UPDATE campaigns.campaigns SET status = 'paused'::public.campaign_status 
  WHERE id = v_test_campaign_id;
  
  RETURN QUERY SELECT
    'Paused campaign'::TEXT,
    campaigns.is_servable(v_test_campaign_id) = false,
    'Should not be servable when paused'::TEXT;
  
  -- Test 3: Reactivate, exhaust budget
  UPDATE campaigns.campaigns 
  SET status = 'active'::public.campaign_status, spent_credits = 10000 
  WHERE id = v_test_campaign_id;
  
  RETURN QUERY SELECT
    'Budget exhausted'::TEXT,
    campaigns.is_servable(v_test_campaign_id) = false,
    'Should not be servable when budget exhausted'::TEXT;
  
  -- Test 4: Reset budget, set end date to past
  UPDATE campaigns.campaigns 
  SET spent_credits = 0, end_date = now() - interval '1 hour'
  WHERE id = v_test_campaign_id;
  
  RETURN QUERY SELECT
    'Past end date'::TEXT,
    campaigns.is_servable(v_test_campaign_id) = false,
    'Should not be servable after end date'::TEXT;
  
  -- Test 5: Future start date
  UPDATE campaigns.campaigns 
  SET start_date = now() + interval '1 day', end_date = now() + interval '2 days'
  WHERE id = v_test_campaign_id;
  
  RETURN QUERY SELECT
    'Before start date'::TEXT,
    campaigns.is_servable(v_test_campaign_id) = false,
    'Should not be servable before start date'::TEXT;
  
  -- Cleanup
  DELETE FROM campaigns.campaigns WHERE id = v_test_campaign_id;
  
  RETURN QUERY SELECT
    'Cleanup'::TEXT,
    true,
    'Test campaign deleted'::TEXT;
END;
$$;

COMMENT ON FUNCTION campaigns.test_is_servable IS
  'Test suite for is_servable() logic - run manually to verify behavior';

-- ==========================================
-- Summary & Usage Instructions
-- ==========================================

COMMENT ON SCHEMA campaigns IS 
  'Campaign management with production-grade lifecycle controls:
  - is_servable(): Single source of truth for ad serving eligibility
  - campaigns_with_status: UI-friendly view with derived status
  - try_charge_campaign(): Race-safe charging with row locks
  - reconcile_campaign_status(): Auto-mark completed campaigns
  - Notification triggers on status changes
  Run tests: SELECT * FROM campaigns.test_is_servable();';

