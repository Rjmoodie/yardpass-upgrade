-- YardPass Growth Upgrade Migration

-- 1) FOLLOW GRAPH
CREATE TYPE follow_target AS ENUM ('organizer','event');

CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type follow_target NOT NULL,
  target_id UUID NOT NULL, -- points to organizations.id when 'organizer', events.id when 'event'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_user_id, target_type, target_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_user_id);
CREATE INDEX IF NOT EXISTS idx_follows_target ON public.follows (target_type, target_id);

-- Row Level Security
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Allow reading follows for everyone (public counts)
CREATE POLICY "follows_read_all" ON public.follows
FOR SELECT USING (true);

-- Only logged-in user can follow/unfollow themselves
CREATE POLICY "follows_insert_own" ON public.follows
FOR INSERT WITH CHECK (auth.uid() = follower_user_id);

CREATE POLICY "follows_delete_own" ON public.follows
FOR DELETE USING (auth.uid() = follower_user_id);

-- 2) REPORTS (lightweight moderation)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','event','user')),
  target_id UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Anyone logged-in can create a report
CREATE POLICY "reports_insert_any" ON public.reports
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only admins/secure service role should read; keep public simple (deny by default).
CREATE POLICY "reports_deny_read" ON public.reports
FOR SELECT USING (false);

-- 3) Add verification status to organizations if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'is_verified') THEN
        ALTER TABLE public.organizations ADD COLUMN is_verified BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 4) Add ticket quantity tracking to ticket_tiers if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_tiers' AND column_name = 'total_quantity') THEN
        ALTER TABLE public.ticket_tiers ADD COLUMN total_quantity INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ticket_tiers' AND column_name = 'sold_quantity') THEN
        ALTER TABLE public.ticket_tiers ADD COLUMN sold_quantity INTEGER DEFAULT 0;
    END IF;
END $$;

-- 5) FEED SCORING (event-level ranking)
CREATE OR REPLACE FUNCTION public.get_home_feed_ids(p_user_id UUID, p_limit INT DEFAULT 12)
RETURNS TABLE (
  event_id UUID,
  score NUMERIC
)
LANGUAGE SQL STABLE AS $$
  WITH base AS (
    -- recent events and/or those with recent posts
    SELECT
      e.id AS event_id,
      -- Freshness: newer events score higher (decay from now to event start)
      GREATEST(0, 1.0 / (1 + EXTRACT(EPOCH FROM (now() - COALESCE(e.start_at, now()))) / 86400.0)) AS freshness,
      -- Engagement: likes + comments from posts in last 7 days
      COALESCE((
        SELECT SUM(COALESCE(p.like_count,0) + COALESCE(p.comment_count,0))
        FROM event_posts p
        WHERE p.event_id = e.id
          AND p.created_at >= now() - INTERVAL '7 days'
          AND p.deleted_at IS NULL
      ), 0) AS engagement,
      -- Affinity: follows on organizer or event by this user
      CASE
        WHEN p_user_id IS NULL THEN 0
        ELSE (
          SELECT COUNT(1)::NUMERIC
          FROM follows f
          WHERE f.follower_user_id = p_user_id
            AND (
              (f.target_type = 'event' AND f.target_id = e.id)
              OR (f.target_type = 'organizer' AND f.target_id = e.owner_context_id)
            )
        )
      END AS affinity
    FROM events e
    WHERE COALESCE(e.end_at, e.start_at, now() + INTERVAL '10 years') >= now() - INTERVAL '1 day'
      AND e.visibility IN ('public', 'unlisted')
  )
  SELECT
    event_id,
    -- Tune weights: freshness 0.5, engagement 0.3, affinity 0.2
    (freshness * 0.5) + (LEAST(1, engagement / 50.0) * 0.3) + (LEAST(1, affinity) * 0.2) AS score
  FROM base
  ORDER BY score DESC
  LIMIT p_limit
$$;

-- Grant to anon for guest feed (safe: returns IDs only)
GRANT EXECUTE ON FUNCTION public.get_home_feed_ids(UUID,INT) TO anon, authenticated;