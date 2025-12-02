-- ============================================================================
-- Migration: Data Retention Policy
-- Purpose: Automatic cleanup of old logs, analytics, and audit data
-- Author: AI Assistant
-- Date: 2025-01-13
-- ============================================================================

-- Define retention windows (in days)
-- These can be adjusted based on compliance requirements
DO $$
DECLARE
  v_logs_retention_days INTEGER := 90;      -- 3 months
  v_analytics_retention_days INTEGER := 365; -- 12 months (aggregate after 3 months)
  v_video_errors_retention_days INTEGER := 30; -- 30 days
  v_audit_retention_days INTEGER := 730;  -- 24 months (2 years)
BEGIN
  -- Store retention policy settings in a configuration table
  CREATE TABLE IF NOT EXISTS public.data_retention_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL,
    aggregate_before_delete BOOLEAN DEFAULT false,
    last_cleanup_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- Insert retention policies
  INSERT INTO public.data_retention_config (table_name, retention_days, aggregate_before_delete)
  VALUES
    ('analytics.events', v_analytics_retention_days, true),
    ('analytics.video_errors', v_video_errors_retention_days, false),
    ('analytics.audit_log', v_audit_retention_days, false)
  ON CONFLICT (table_name) DO UPDATE
    SET retention_days = EXCLUDED.retention_days,
        updated_at = now();

  -- Note: Logs are typically in application logs, not database
  -- If you have a logs table, add it here
END $$;

-- Function to aggregate old analytics events before deletion
CREATE OR REPLACE FUNCTION analytics.aggregate_old_events(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS TABLE(
  aggregated_count BIGINT,
  date_range_start DATE,
  date_range_end DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, public
AS $$
DECLARE
  v_cutoff_date DATE;
BEGIN
  v_cutoff_date := CURRENT_DATE - p_retention_days;

  -- Aggregate events by day, event_type, and user_id
  -- Store in a summary table (create if doesn't exist)
  CREATE TABLE IF NOT EXISTS analytics.events_daily_summary (
    summary_date DATE NOT NULL,
    event_type TEXT NOT NULL,
    user_id UUID,
    event_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (summary_date, event_type, user_id)
  );

  -- Insert aggregated data
  -- Note: analytics.events uses 'ts' as the timestamp column, not 'created_at'
  INSERT INTO analytics.events_daily_summary (summary_date, event_type, user_id, event_count)
  SELECT
    DATE(ts) as summary_date,
    event_name as event_type,  -- event_name is the event type in analytics.events
    user_id,
    COUNT(*)::INTEGER as event_count
  FROM analytics.events
  WHERE DATE(ts) < v_cutoff_date
  GROUP BY DATE(ts), event_name, user_id
  ON CONFLICT (summary_date, event_type, user_id) DO UPDATE
    SET event_count = analytics.events_daily_summary.event_count + EXCLUDED.event_count;

  -- Return summary
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as aggregated_count,
    MIN(DATE(ts)) as date_range_start,
    MAX(DATE(ts)) as date_range_end
  FROM analytics.events
  WHERE DATE(ts) < v_cutoff_date;

  -- Delete old events after aggregation
  DELETE FROM analytics.events
  WHERE DATE(ts) < v_cutoff_date;
END;
$$;

COMMENT ON FUNCTION analytics.aggregate_old_events IS 'Aggregates analytics events older than retention period before deletion';

-- Function to clean up old video errors
CREATE OR REPLACE FUNCTION analytics.cleanup_old_video_errors(
  p_retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, public
AS $$
DECLARE
  v_deleted_count INTEGER;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  v_cutoff_date := now() - (p_retention_days || ' days')::INTERVAL;

  DELETE FROM analytics.video_errors
  WHERE created_at < v_cutoff_date;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION analytics.cleanup_old_video_errors IS 'Deletes video errors older than retention period';

-- Function to clean up old audit logs
CREATE OR REPLACE FUNCTION analytics.cleanup_old_audit_logs(
  p_retention_days INTEGER DEFAULT 730
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, public
AS $$
DECLARE
  v_deleted_count INTEGER;
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  v_cutoff_date := now() - (p_retention_days || ' days')::INTERVAL;

  -- Note: analytics.audit_log uses 'ts' as the timestamp column, not 'created_at'
  DELETE FROM analytics.audit_log
  WHERE ts < v_cutoff_date;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION analytics.cleanup_old_audit_logs IS 'Deletes audit logs older than retention period';

-- Main cleanup function that runs all retention policies
CREATE OR REPLACE FUNCTION public.run_data_retention_cleanup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, analytics
AS $$
DECLARE
  v_result JSONB := '{}'::JSONB;
  v_config RECORD;
  v_cleanup_result JSONB;
  v_deleted_count INTEGER;
  v_aggregated_count BIGINT;
BEGIN
  -- Loop through all retention policies
  FOR v_config IN
    SELECT * FROM public.data_retention_config
    ORDER BY table_name
  LOOP
    BEGIN
      IF v_config.table_name = 'analytics.events' AND v_config.aggregate_before_delete THEN
        -- Aggregate before deleting
        SELECT jsonb_build_object(
          'aggregated_count', aggregated_count,
          'date_range_start', date_range_start,
          'date_range_end', date_range_end
        ) INTO v_cleanup_result
        FROM analytics.aggregate_old_events(v_config.retention_days);
        
        v_result := v_result || jsonb_build_object(
          v_config.table_name,
          jsonb_build_object(
            'action', 'aggregated_and_deleted',
            'retention_days', v_config.retention_days,
            'result', v_cleanup_result
          )
        );

      ELSIF v_config.table_name = 'analytics.video_errors' THEN
        v_deleted_count := analytics.cleanup_old_video_errors(v_config.retention_days);
        v_result := v_result || jsonb_build_object(
          v_config.table_name,
          jsonb_build_object(
            'action', 'deleted',
            'retention_days', v_config.retention_days,
            'deleted_count', v_deleted_count
          )
        );

      ELSIF v_config.table_name = 'analytics.audit_log' THEN
        v_deleted_count := analytics.cleanup_old_audit_logs(v_config.retention_days);
        v_result := v_result || jsonb_build_object(
          v_config.table_name,
          jsonb_build_object(
            'action', 'deleted',
            'retention_days', v_config.retention_days,
            'deleted_count', v_deleted_count
          )
        );
      END IF;

      -- Update last cleanup timestamp
      UPDATE public.data_retention_config
      SET last_cleanup_at = now()
      WHERE table_name = v_config.table_name;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other tables
      v_result := v_result || jsonb_build_object(
        v_config.table_name,
        jsonb_build_object(
          'error', SQLERRM,
          'action', 'failed'
        )
      );
    END;
  END LOOP;

  -- Add metadata
  v_result := v_result || jsonb_build_object(
    'cleanup_run_at', now(),
    'status', 'completed'
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.run_data_retention_cleanup IS 'Main function to run all data retention cleanup policies';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.run_data_retention_cleanup() TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.aggregate_old_events(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.cleanup_old_video_errors(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.cleanup_old_audit_logs(INTEGER) TO authenticated;

-- Create index on timestamp columns for faster cleanup queries
-- Note: Cannot use now() in WHERE clause (not IMMUTABLE), so create regular indexes
-- The cleanup functions will filter by date at query time
-- Note: analytics.events uses 'ts', analytics.audit_log uses 'ts', video_errors uses 'created_at'
CREATE INDEX IF NOT EXISTS idx_analytics_events_ts_retention 
  ON analytics.events(ts);

CREATE INDEX IF NOT EXISTS idx_analytics_video_errors_created_at 
  ON analytics.video_errors(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_audit_log_ts_retention 
  ON analytics.audit_log(ts);

