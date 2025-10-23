-- 004_create_post_video_counters.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.post_video_counters (
  post_id uuid PRIMARY KEY REFERENCES public.event_posts(id) ON DELETE CASCADE,
  views_total bigint DEFAULT 0,
  views_unique bigint DEFAULT 0,
  completions bigint DEFAULT 0,
  avg_dwell_ms bigint DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

COMMIT;
