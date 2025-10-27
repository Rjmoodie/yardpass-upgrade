-- Check if RPC functions exist in public schema
\echo '=== Checking RPC Functions ==='

SELECT 
  routine_schema,
  routine_name,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name IN ('log_impression_and_charge', 'log_click_and_charge', 'attribute_conversion')
ORDER BY routine_schema, routine_name;

\echo ''
\echo '=== Checking function parameters for log_impression_and_charge ==='

SELECT 
  parameter_name,
  data_type,
  parameter_mode
FROM information_schema.parameters
WHERE specific_schema = 'public' 
  AND specific_name = (
    SELECT specific_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name = 'log_impression_and_charge'
    LIMIT 1
  )
ORDER BY ordinal_position;

\echo ''
\echo '=== Checking function parameters for log_click_and_charge ==='

SELECT 
  parameter_name,
  data_type,
  parameter_mode
FROM information_schema.parameters
WHERE specific_schema = 'public' 
  AND specific_name = (
    SELECT specific_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name = 'log_click_and_charge'
    LIMIT 1
  )
ORDER BY ordinal_position;

\echo ''
\echo '=== Test calling log_impression_and_charge ==='

SELECT * FROM public.log_impression_and_charge(
  p_campaign_id := '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec',
  p_creative_id := 'cc3d6b97-2d18-4c08-bf2e-682a2f8e74bc',
  p_user_id := NULL,
  p_session_id := 'test-session-' || gen_random_uuid()::text,
  p_event_id := '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec',
  p_placement := 'feed',
  p_request_id := gen_random_uuid(),
  p_pricing_model := 'cpm',
  p_rate_credits := 2.06,
  p_bid_credits := 2.50,
  p_viewable := true,
  p_pct_visible := 100,
  p_dwell_ms := 1500,
  p_freq_cap := 3
);

