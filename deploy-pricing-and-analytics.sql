-- Deploy Script: Update Pricing + Add Analytics

-- Step 1: Update campaign pricing to $5 CPM (500 credits)
UPDATE campaigns.campaigns
SET 
  pricing_model = 'cpm',
  cpm_rate_credits = 500,
  cpc_rate_credits = 50,
  updated_at = NOW()
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

SELECT 
  '✅ Campaign Pricing Updated' as status,
  name,
  cpm_rate_credits as new_cpm,
  cpc_rate_credits as new_cpc
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Step 2: Create Analytics RPCs
\i supabase/migrations/20251026190000_create_analytics_rpcs.sql

SELECT '✅ Analytics RPCs Created' as status;

