-- 008_partitioning_templates.sql
-- Optional templates for monthly partitions for post telemetry.

-- Parent example (run once if you want partitioning)
-- CREATE TABLE IF NOT EXISTS public.post_views_p (
--   LIKE public.post_views INCLUDING ALL
-- ) PARTITION BY RANGE (created_at);

-- Example child for 2025-01
-- CREATE TABLE IF NOT EXISTS public.post_views_p_202501
-- PARTITION OF public.post_views_p
-- FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
