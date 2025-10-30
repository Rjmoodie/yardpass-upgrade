-- ========================================
-- CHECK CAMPAIGN SETUP COMPLETENESS
-- Campaign: 3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec
-- ========================================

-- 1. Campaign Details
SELECT 
  id,
  name,
  status,
  org_id,
  start_date,
  end_date,
  total_budget_credits,
  spent_credits,
  pricing_model,
  objective,
  pacing_strategy
FROM campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 2. Check Active Creatives
SELECT 
  id,
  campaign_id,
  headline,
  body_text,
  cta_label,
  cta_url,
  media_type,
  media_url,
  active,
  created_at
FROM ad_creatives
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 3. Check if campaign is eligible for ad delivery
SELECT 
  'Campaign Status' as check_item,
  CASE 
    WHEN status = 'active' THEN '✅ Active'
    ELSE '❌ Not active: ' || status
  END as result
FROM campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'

UNION ALL

SELECT 
  'Start Date' as check_item,
  CASE 
    WHEN start_date <= NOW() THEN '✅ Started'
    ELSE '❌ Future start: ' || start_date::text
  END as result
FROM campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'

UNION ALL

SELECT 
  'End Date' as check_item,
  CASE 
    WHEN end_date IS NULL THEN '✅ No end date'
    WHEN end_date >= NOW() THEN '✅ Not ended'
    ELSE '❌ Already ended: ' || end_date::text
  END as result
FROM campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'

UNION ALL

SELECT 
  'Budget' as check_item,
  CASE 
    WHEN spent_credits < total_budget_credits THEN '✅ Budget available: ' || (total_budget_credits - spent_credits)::text || ' credits'
    ELSE '❌ Budget exhausted'
  END as result
FROM campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'

UNION ALL

SELECT 
  'Active Creatives' as check_item,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Has ' || COUNT(*)::text || ' active creative(s)'
    ELSE '❌ No active creatives'
  END as result
FROM ad_creatives
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND active = true;

-- 4. Summary: What's needed?
SELECT 
  c.id,
  c.name,
  c.status,
  c.total_budget_credits - c.spent_credits as remaining_budget,
  COUNT(cr.id) as total_creatives,
  SUM(CASE WHEN cr.active THEN 1 ELSE 0 END) as active_creatives,
  CASE 
    WHEN c.status != 'active' THEN '❌ Campaign must be ACTIVE'
    WHEN c.start_date > NOW() THEN '❌ Campaign start date is in the future'
    WHEN c.end_date IS NOT NULL AND c.end_date < NOW() THEN '❌ Campaign has ended'
    WHEN c.spent_credits >= c.total_budget_credits THEN '❌ Budget exhausted'
    WHEN NOT EXISTS(SELECT 1 FROM ad_creatives WHERE campaign_id = c.id AND active = true) THEN '❌ Need at least 1 ACTIVE creative'
    ELSE '✅ Campaign ready for delivery'
  END as delivery_status
FROM campaigns c
LEFT JOIN ad_creatives cr ON cr.campaign_id = c.id
WHERE c.id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
GROUP BY c.id, c.name, c.status, c.start_date, c.end_date, c.total_budget_credits, c.spent_credits;

