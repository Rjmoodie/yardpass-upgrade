-- Performance indexes for hot paths
CREATE INDEX IF NOT EXISTS idx_event_posts_event_created_at_partial
ON public.event_posts (event_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_posts_author_created_at_partial
ON public.event_posts (author_user_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reactions_post_kind_user
ON public.event_reactions (post_id, kind, user_id);

CREATE INDEX IF NOT EXISTS idx_comments_post_created_partial
ON public.event_comments (post_id, created_at ASC);

-- Idempotency keys table for edge functions
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id UUID NOT NULL,
  bucket TEXT NOT NULL,
  minute TIMESTAMP WITH TIME ZONE NOT NULL,
  count INTEGER DEFAULT 1,
  PRIMARY KEY (user_id, bucket, minute)
);

-- Materialized view for trending posts
CREATE MATERIALIZED VIEW IF NOT EXISTS public.trending_posts AS
SELECT 
  p.id, 
  p.event_id, 
  p.created_at, 
  p.like_count, 
  p.comment_count,
  (p.like_count * 2 + p.comment_count) AS trending_score
FROM public.event_posts p
WHERE p.deleted_at IS NULL
ORDER BY (p.like_count * 2 + p.comment_count) DESC, p.created_at DESC
LIMIT 500;

CREATE INDEX IF NOT EXISTS idx_trending_posts ON public.trending_posts (event_id, created_at DESC);

-- Function to refresh trending posts
CREATE OR REPLACE FUNCTION public.refresh_trending_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.trending_posts;
END;
$$;

-- Cleanup old idempotency keys (retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.idempotency_keys 
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  DELETE FROM public.rate_limits 
  WHERE minute < NOW() - INTERVAL '1 hour';
END;
$$;