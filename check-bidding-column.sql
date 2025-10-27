-- Check the bidding column structure
SELECT 
  id,
  name,
  pricing_model,
  bidding,
  targeting,
  pacing,
  freq_cap
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

