-- Fix missing log_ai_recommendation RPC (404 error)

-- Check if the function exists in analytics schema
SELECT routine_name, routine_schema
FROM information_schema.routines
WHERE routine_name = 'log_ai_recommendation';

-- Create public wrapper for log_ai_recommendation
CREATE OR REPLACE FUNCTION public.log_ai_recommendation(
  p_campaign_id UUID,
  p_recommendation_type TEXT,
  p_confidence TEXT,
  p_data JSONB DEFAULT '{}'::JSONB
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
    p_recommendation_type,
    p_confidence::analytics.ai_confidence,
    p_data,
    true
  )
  RETURNING id INTO v_rec_id;
  
  RETURN v_rec_id;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.log_ai_recommendation TO authenticated, anon;

-- Create mark_ai_rec_applied wrapper if it doesn't exist
CREATE OR REPLACE FUNCTION public.mark_ai_rec_applied(
  p_recommendation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE analytics.ai_recommendation_events
  SET 
    was_applied = true,
    applied_at = NOW()
  WHERE id = p_recommendation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_ai_rec_applied TO authenticated, anon;

-- Verify
SELECT 
  routine_name,
  routine_schema,
  routine_type
FROM information_schema.routines
WHERE routine_name IN ('log_ai_recommendation', 'mark_ai_rec_applied')
  AND routine_schema = 'public';

