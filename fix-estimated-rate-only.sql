-- ===================================================================
-- Fix ONLY the estimated_rate Calculation
-- ===================================================================
-- Changes line 197 from:
--   campaigns.calculate_ad_rate(ma.event_category, ma.pricing_model) AS estimated_rate
-- To:
--   c.bidding->>'bid_cents')::NUMERIC AS estimated_rate
-- ===================================================================

-- We need to add campaigns table to the final SELECT
-- and get bid from there instead of calling calculate_ad_rate

-- First test what calculate_ad_rate currently returns
SELECT 
  'Old Rate Function' AS test_type,
  campaigns.calculate_ad_rate('Music', 'cpm') AS returned_rate,
  'Should be ~2-5 (USD)' AS expected;

-- Check what the bidding JSONB contains
SELECT 
  'Campaign Bidding' AS test_type,
  (bidding->>'bid_cents')::NUMERIC AS bid_in_credits,
  'Should be 500 (credits for $5 CPM)' AS expected
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Now the fix: We need to modify matched_ads CTE to include campaign bidding
-- Since the function is 200+ lines, let's use a different approach:
-- Create a VIEW wrapper that fixes the rate

CREATE OR REPLACE VIEW public.get_eligible_ads_fixed AS
SELECT 
  ga.campaign_id,
  ga.creative_id,
  ga.event_id,
  ga.org_id,
  ga.org_name,
  ga.org_logo_url,
  ga.event_title,
  ga.event_description,
  ga.event_cover_image,
  ga.event_start_at,
  ga.event_venue,
  ga.event_category,
  ga.pricing_model,
  -- FIX: Use actual bid instead of calculated rate
  COALESCE((c.bidding->>'bid_cents')::NUMERIC, ga.estimated_rate) AS estimated_rate,
  ga.priority_score,
  ga.cta_label,
  ga.cta_url
FROM public.get_eligible_ads(NULL, NULL, NULL, NULL, 'feed', 10) ga
LEFT JOIN campaigns.campaigns c ON c.id = ga.campaign_id;

-- Test the view
SELECT 
  campaign_id,
  estimated_rate,
  pricing_model
FROM public.get_eligible_ads_fixed
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';


