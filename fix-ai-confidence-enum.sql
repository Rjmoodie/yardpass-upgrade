-- Fix ai_confidence enum issue

-- Check if the enum exists
SELECT typname, enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname = 'ai_confidence';

-- If enum doesn't exist, we need to use TEXT instead
-- Recreate the function without the enum cast
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
  -- Insert into telemetry table (without enum cast)
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
    p_confidence,  -- No enum cast
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

GRANT EXECUTE ON FUNCTION public.log_ai_recommendation TO authenticated, anon;

-- Check the table structure
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'analytics'
  AND table_name = 'ai_recommendation_events'
  AND column_name = 'confidence';

