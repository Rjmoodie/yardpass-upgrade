-- ===================================================================
-- Check How Ad Rate is Calculated
-- ===================================================================

-- Check what get_eligible_ads returns for estimated_rate
SELECT 
  c.id AS campaign_id,
  c.name,
  c.pricing_model,
  c.bidding,
  cr.id AS creative_id,
  cr.headline,
  -- This is what should be returned as estimated_rate:
  CASE 
    WHEN c.pricing_model = 'cpm' THEN 
      COALESCE((c.bidding->>'bid_cents')::numeric / 100.0, 0)
    WHEN c.pricing_model = 'cpc' THEN 
      COALESCE((c.bidding->>'bid_cents')::numeric / 100.0, 0)
    ELSE 0
  END AS calculated_estimated_rate_usd,
  -- What it SHOULD be in credits:
  CASE 
    WHEN c.pricing_model = 'cpm' THEN 
      COALESCE((c.bidding->>'bid_cents')::numeric, 0) -- CPM in credits (500 for $5)
    WHEN c.pricing_model = 'cpc' THEN 
      COALESCE((c.bidding->>'bid_cents')::numeric, 0) -- CPC in credits
    ELSE 0
  END AS should_be_credits
FROM campaigns.campaigns c
LEFT JOIN campaigns.ad_creatives cr ON cr.campaign_id = c.id
WHERE c.id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
LIMIT 1;



