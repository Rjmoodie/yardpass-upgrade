-- Schedule MV refresh every 10 minutes
SELECT cron.schedule(
  'campaign_analytics_refresh_10min',
  '*/10 * * * *',
  $$ SELECT refresh_campaign_analytics(true); $$
);

-- Optional: Create refresh log table for monitoring
CREATE TABLE IF NOT EXISTS mv_refresh_log (
  id BIGSERIAL PRIMARY KEY,
  ran_at TIMESTAMPTZ DEFAULT NOW(),
  concurrent BOOLEAN NOT NULL,
  duration_ms INT,
  note TEXT
);

-- Update refresh function to log performance
CREATE OR REPLACE FUNCTION refresh_campaign_analytics(p_concurrently BOOLEAN DEFAULT TRUE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t1 TIMESTAMPTZ := clock_timestamp();
  t2 TIMESTAMPTZ;
BEGIN
  IF p_concurrently THEN
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_analytics_daily';
  ELSE
    EXECUTE 'REFRESH MATERIALIZED VIEW campaign_analytics_daily';
  END IF;
  
  t2 := clock_timestamp();
  INSERT INTO mv_refresh_log(concurrent, duration_ms)
  VALUES (p_concurrently, EXTRACT(MILLISECONDS FROM t2 - t1));
END;
$$;

REVOKE ALL ON FUNCTION refresh_campaign_analytics(BOOLEAN) FROM PUBLIC;