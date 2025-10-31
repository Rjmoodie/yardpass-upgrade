-- Test the new period comparison RPC function
-- This should return comparison data for your campaign

SELECT 
  metric,
  current_value,
  previous_value,
  change_pct
FROM public.get_campaign_kpis_comparison(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'::UUID,
  7
);

-- Expected output:
-- metric       | current_value | previous_value | change_pct
-- -------------|---------------|----------------|----------
-- impressions  | 1.0           | 0.0            | 0.0
-- clicks       | 1.0           | 0.0            | 0.0
-- conversions  | 0.0           | 0.0            | 0.0
-- spend        | 0.5           | 0.0            | 0.0
-- revenue      | 0.0           | 0.0            | 0.0

-- Try with 14 days:
SELECT * FROM public.get_campaign_kpis_comparison(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'::UUID,
  14
);




