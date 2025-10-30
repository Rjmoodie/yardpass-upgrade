-- ========================================
-- SIMPLE Campaign Check
-- No complex queries, just the basics
-- ========================================

-- 1. Your campaign details
SELECT * FROM campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 2. Your creatives
SELECT * FROM ad_creatives
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 3. Count active creatives
SELECT 
  COUNT(*) as total_creatives,
  COUNT(*) FILTER (WHERE active = true) as active_creatives
FROM ad_creatives
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

