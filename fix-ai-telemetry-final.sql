-- Final fix - match actual table structure

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
  -- Insert into telemetry table with correct column names
  INSERT INTO analytics.ai_recommendation_events (
    campaign_id,
    user_id,
    rec_type,
    rec_title,
    actions,
    confidence,
    expected_impact,
    was_applied
  )
  VALUES (
    p_campaign_id,
    auth.uid(),
    p_rec_type,
    p_rec_title,
    p_actions,
    p_confidence,
    p_expected_impact,
    false  -- Initially not applied
  )
  RETURNING id INTO v_rec_id;
  
  RETURN v_rec_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_ai_recommendation TO authenticated, anon;

-- Verify
SELECT 'log_ai_recommendation function recreated' AS status;

