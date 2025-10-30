-- Fix log_ai_recommendation to match frontend parameter names

DROP FUNCTION IF EXISTS public.log_ai_recommendation(UUID, TEXT, TEXT, JSONB);

-- Create with correct parameter names that match the frontend
CREATE OR REPLACE FUNCTION public.log_ai_recommendation(
  p_campaign_id UUID,
  p_rec_type TEXT,
  p_rec_title TEXT,
  p_actions JSONB,
  p_confidence TEXT,
  p_expected_impact TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec_id UUID;
BEGIN
  -- Insert into telemetry table
  INSERT INTO analytics.ai_recommendation_events (
    campaign_id,
    user_id,
    recommendation_type,
    confidence,
    recommendation_data,
    was_shown
  )
  VALUES (
    p_campaign_id,
    auth.uid(),
    p_rec_type,
    p_confidence::analytics.ai_confidence,
    jsonb_build_object(
      'title', p_rec_title,
      'actions', p_actions,
      'expected_impact', p_expected_impact
    ),
    true
  )
  RETURNING id INTO v_rec_id;
  
  RETURN v_rec_id;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.log_ai_recommendation TO authenticated, anon;

-- Verify the function signature
SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'log_ai_recommendation'
  AND n.nspname = 'public';

