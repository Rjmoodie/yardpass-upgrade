-- ==========================================
-- Verify AI Recommendations Deployment
-- ==========================================
-- Run these queries to confirm everything is deployed

-- 1. Check if category_benchmarks view exists
SELECT * FROM public.category_benchmarks LIMIT 1;

-- 2. Check if RPCs exist
SELECT proname, pronargs 
FROM pg_proc 
WHERE proname IN (
  'campaign_increase_daily_budget',
  'campaign_raise_cpm', 
  'campaign_update_freq_cap',
  'log_ai_recommendation',
  'mark_ai_rec_applied'
)
ORDER BY proname;

-- 3. Check if telemetry table exists
SELECT COUNT(*) as telemetry_table_exists 
FROM information_schema.tables 
WHERE table_schema = 'analytics' 
AND table_name = 'ai_recommendation_events';

-- 4. Check if we have any benchmark data
SELECT 
  category,
  ctr_median,
  spend_median,
  sample_size
FROM public.category_benchmarks;

-- 5. Test a campaign has analytics data
SELECT 
  campaign_id,
  COUNT(*) as days_of_data,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks
FROM public.analytics_campaign_daily
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
GROUP BY campaign_id;

-- Expected results:
-- ✅ category_benchmarks returns data
-- ✅ 5 RPC functions listed
-- ✅ telemetry_table_exists = 1
-- ✅ benchmark has ctr_median and sample_size > 0
-- ✅ Campaign has days_of_data and impressions

