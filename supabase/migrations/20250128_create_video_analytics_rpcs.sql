-- Create RPC functions for video analytics inserts
-- This allows Edge Functions to insert data without needing direct schema access

-- Drop all existing versions of these functions (handles multiple overloads)
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Drop all versions of insert_video_error
  FOR func_record IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname = 'insert_video_error'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.insert_video_error(' || func_record.args || ') CASCADE';
  END LOOP;
  
  -- Drop all versions of insert_video_metric
  FOR func_record IN 
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname = 'insert_video_metric'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS public.insert_video_metric(' || func_record.args || ') CASCADE';
  END LOOP;
END $$;

-- RPC function to insert video errors
CREATE OR REPLACE FUNCTION public.insert_video_error(
  p_error_type TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_playback_id TEXT DEFAULT NULL,
  p_url TEXT DEFAULT NULL,
  p_post_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_context JSONB DEFAULT '{}'::jsonb,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO analytics.video_errors (
    error_type,
    playback_id,
    url,
    error_message,
    post_id,
    event_id,
    user_id,
    session_id,
    context,
    ip_address,
    user_agent
  ) VALUES (
    p_error_type,
    p_playback_id,
    p_url,
    COALESCE(p_error_message, 'Unknown error'),
    p_post_id,
    p_event_id,
    p_user_id,
    p_session_id,
    p_context,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- RPC function to insert video metrics
CREATE OR REPLACE FUNCTION public.insert_video_metric(
  p_metric TEXT,
  p_value NUMERIC, -- Accept decimal, will be rounded to INTEGER
  p_playback_id TEXT DEFAULT NULL,
  p_url TEXT DEFAULT NULL,
  p_post_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_context JSONB DEFAULT '{}'::jsonb,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO analytics.video_metrics (
    metric,
    playback_id,
    url,
    value,
    post_id,
    event_id,
    user_id,
    session_id,
    context,
    ip_address,
    user_agent
  ) VALUES (
    p_metric,
    p_playback_id,
    p_url,
    ROUND(p_value)::INTEGER, -- Round to nearest integer for INTEGER column
    p_post_id,
    p_event_id,
    p_user_id,
    p_session_id,
    p_context,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Grant execute to service_role (Edge Functions)
GRANT EXECUTE ON FUNCTION public.insert_video_error TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_video_metric TO service_role;

-- Comments
COMMENT ON FUNCTION public.insert_video_error IS 'Insert video error tracking data into analytics.video_errors';
COMMENT ON FUNCTION public.insert_video_metric IS 'Insert video performance metric data into analytics.video_metrics';

-- Notify PostgREST to reload schema cache (so it can see the new functions)
NOTIFY pgrst, 'reload schema';

