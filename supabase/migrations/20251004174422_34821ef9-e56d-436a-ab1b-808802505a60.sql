-- Create impression tracking tables
CREATE TABLE IF NOT EXISTS public.event_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  dwell_ms INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.event_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  dwell_ms INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.negative_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('event', 'post')),
  target_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- Enable RLS
ALTER TABLE public.event_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negative_feedback ENABLE ROW LEVEL SECURITY;

-- Add constraints with existence checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'event_impressions' AND c.conname = 'event_impressions_dwell_valid'
  ) THEN
    ALTER TABLE public.event_impressions
      ADD CONSTRAINT event_impressions_dwell_valid CHECK (dwell_ms >= 0 AND dwell_ms <= 60*60*1000);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'post_impressions' AND c.conname = 'post_impressions_dwell_valid'
  ) THEN
    ALTER TABLE public.post_impressions
      ADD CONSTRAINT post_impressions_dwell_valid CHECK (dwell_ms >= 0 AND dwell_ms <= 60*60*1000);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'event_impressions' AND c.conname = 'event_impressions_session_len'
  ) THEN
    ALTER TABLE public.event_impressions
      ADD CONSTRAINT event_impressions_session_len CHECK (session_id IS NULL OR length(session_id) BETWEEN 16 AND 64);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'post_impressions' AND c.conname = 'post_impressions_session_len'
  ) THEN
    ALTER TABLE public.post_impressions
      ADD CONSTRAINT post_impressions_session_len CHECK (session_id IS NULL OR length(session_id) BETWEEN 16 AND 64);
  END IF;
END $$;

-- Performance indexes (composite time-ordered only, no redundant user indexes)
CREATE INDEX IF NOT EXISTS idx_event_impressions_session_time
  ON public.event_impressions(session_id, created_at DESC) WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_impressions_session_time
  ON public.post_impressions(session_id, created_at DESC) WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS brin_event_impressions_created
  ON public.event_impressions USING brin (created_at);

CREATE INDEX IF NOT EXISTS brin_post_impressions_created
  ON public.post_impressions USING brin (created_at);

CREATE INDEX IF NOT EXISTS idx_event_impressions_user_time
  ON public.event_impressions(user_id, created_at DESC) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_post_impressions_user_time
  ON public.post_impressions(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Analytics schema for rollups
CREATE SCHEMA IF NOT EXISTS analytics;

-- Daily event impression rollup
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.event_impressions_daily AS
SELECT
  event_id,
  date_trunc('day', created_at) AS day,
  count(*)                           AS impressions,
  sum(dwell_ms)::bigint              AS dwell_ms_sum,
  avg(dwell_ms)::numeric(10,2)       AS dwell_ms_avg
FROM public.event_impressions
GROUP BY 1,2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_impressions_daily_pk
  ON analytics.event_impressions_daily(event_id, day);

-- Daily post impression rollup
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.post_impressions_daily AS
SELECT
  post_id,
  date_trunc('day', created_at) AS day,
  count(*)                                     AS impressions,
  sum(CASE WHEN completed THEN 1 ELSE 0 END)   AS completions,
  avg(dwell_ms)::numeric(10,2)                  AS dwell_ms_avg
FROM public.post_impressions
GROUP BY 1,2;

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_impressions_daily_pk
  ON analytics.post_impressions_daily(post_id, day);

-- Refresh function (non-concurrent to avoid transaction issues)
CREATE OR REPLACE FUNCTION analytics.refresh_impression_rollups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics, public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW analytics.event_impressions_daily;
  REFRESH MATERIALIZED VIEW analytics.post_impressions_daily;
END $$;

-- RLS: Allow users to delete their own negative feedback
CREATE POLICY "Users can delete their own negative feedback"
  ON public.negative_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- RLS: Allow users to read their own impressions
CREATE POLICY "Users can read their own event impressions"
  ON public.event_impressions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read their own post impressions"
  ON public.post_impressions FOR SELECT
  USING (auth.uid() = user_id);

-- Grants
GRANT DELETE ON public.negative_feedback TO authenticated;
GRANT SELECT ON public.event_impressions TO authenticated;
GRANT SELECT ON public.post_impressions TO authenticated;
GRANT USAGE ON SCHEMA analytics TO authenticated;
GRANT SELECT ON analytics.event_impressions_daily TO authenticated;
GRANT SELECT ON analytics.post_impressions_daily TO authenticated;