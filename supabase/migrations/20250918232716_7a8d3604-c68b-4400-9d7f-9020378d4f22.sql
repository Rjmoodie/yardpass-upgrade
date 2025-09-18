-- First, create unique index for search_docs_mv to enable concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS search_docs_mv_unique_idx ON public.search_docs_mv (kind, item_id, post_id);

-- Now run the recommendations system migration
-- Extensions for recommendations system
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;

-- Helper: normalized text
CREATE OR REPLACE FUNCTION public.normalize_text(txt text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(unaccent(COALESCE(txt,'')));
$$;

-- EVENTS: add geo + embedding columns
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS geog geography(point, 4326),
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Update geography from existing lat/lng
UPDATE public.events
SET geog = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL AND geog IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS events_geog_gix ON public.events USING gist (geog);
CREATE INDEX IF NOT EXISTS events_starts_idx ON public.events (start_at);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category);

-- USER PROFILES: home & active location, radius & tz
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS home_geog geography(point, 4326),
  ADD COLUMN IF NOT EXISTS radius_km double precision DEFAULT 25.0,
  ADD COLUMN IF NOT EXISTS tz text,
  ADD COLUMN IF NOT EXISTS active_geog geography(point, 4326),
  ADD COLUMN IF NOT EXISTS active_until timestamptz;

-- INTERACTIONS: single source of truth for rec signals
CREATE TABLE IF NOT EXISTS public.user_event_interactions (
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  kind text NOT NULL,     -- view, watch, like, comment, share, ticket_open, ticket_purchase
  weight int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id, kind, created_at)
);

CREATE INDEX IF NOT EXISTS user_event_interactions_user_created_idx ON public.user_event_interactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_event_interactions_event_idx ON public.user_event_interactions (event_id);
CREATE INDEX IF NOT EXISTS user_event_interactions_kind_idx ON public.user_event_interactions (kind);

-- Daily affinity rollup
DROP MATERIALIZED VIEW IF EXISTS public.user_event_affinity CASCADE;
CREATE MATERIALIZED VIEW public.user_event_affinity AS
SELECT user_id, event_id, sum(weight) as affinity, max(created_at) as last_seen
FROM public.user_event_interactions
GROUP BY 1,2;

CREATE INDEX IF NOT EXISTS user_event_affinity_user_affinity_idx ON public.user_event_affinity (user_id, affinity DESC);

-- User & event embeddings
CREATE TABLE IF NOT EXISTS public.user_embeddings (
  user_id uuid PRIMARY KEY,
  embedding vector(1536),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_embeddings_ivfflat ON public.user_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS events_ivfflat ON public.events
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Co-visitation (last 90 days)
DROP MATERIALIZED VIEW IF EXISTS public.event_covis CASCADE;
CREATE MATERIALIZED VIEW public.event_covis AS
WITH pairs AS (
  SELECT a.event_id AS e1, b.event_id AS e2, count(*) AS cnt
  FROM public.user_event_interactions a
  JOIN public.user_event_interactions b
    ON a.user_id = b.user_id
   AND a.event_id <> b.event_id
   AND a.created_at > now() - interval '90 days'
   AND b.created_at > now() - interval '90 days'
  GROUP BY 1,2
)
SELECT e1, e2, cnt,
       cnt / GREATEST(1, (SELECT count(*) FROM public.user_event_interactions WHERE event_id = e1))::float AS lift
FROM pairs;

CREATE INDEX IF NOT EXISTS event_covis_e1_lift_idx ON public.event_covis (e1, lift DESC);

-- Refresh helpers
CREATE OR REPLACE FUNCTION public.refresh_covis()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.event_covis;
EXCEPTION WHEN feature_not_supported THEN
  REFRESH MATERIALIZED VIEW public.event_covis;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_user_affinity()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_event_affinity;
EXCEPTION WHEN feature_not_supported THEN
  REFRESH MATERIALIZED VIEW public.user_event_affinity;
END;
$$;

-- Update user embedding from interactions (weighted average of event embeddings)
CREATE OR REPLACE FUNCTION public.refresh_user_embedding(p_user uuid)
RETURNS void LANGUAGE sql AS $$
  WITH src AS (
    SELECT e.embedding, uea.weight
    FROM public.user_event_interactions uea
    JOIN public.events e ON e.id = uea.event_id
    WHERE uea.user_id = p_user AND e.embedding IS NOT NULL
  )
  INSERT INTO public.user_embeddings (user_id, embedding, updated_at)
  SELECT p_user,
         (SELECT (sum(embedding * weight)::vector / NULLIF(sum(weight),0)) FROM src),
         now()
  ON CONFLICT (user_id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = now();
$$;

-- Core RPC: recommendations with distance decay + hybrid score
CREATE OR REPLACE FUNCTION public.get_recommendations(
  p_user uuid,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  event_id uuid,
  title text,
  category text,
  starts_at timestamptz,
  distance_km double precision,
  score double precision
) LANGUAGE sql STABLE AS $$
  WITH u AS (
    SELECT
      COALESCE(
        CASE WHEN active_geog IS NOT NULL AND (active_until IS NULL OR active_until > now())
          THEN active_geog ELSE home_geog END,
        home_geog
      ) AS base_geog,
      GREATEST(COALESCE(radius_km, 25), 5) AS radius_km
    FROM public.user_profiles WHERE user_id = p_user
  ),
  content AS (
    SELECT e.id AS event_id, e.title, e.category, e.start_at, e.geog,
           (1 - (ue.embedding <=> e.embedding))::double precision AS sim
    FROM public.user_embeddings ue
    JOIN public.events e ON e.embedding IS NOT NULL AND ue.user_id = p_user
    WHERE e.start_at > now()
  ),
  covis AS (
    SELECT e.id AS event_id, e.title, e.category, e.start_at, e.geog,
           c.score::double precision AS co_vis
    FROM public.events e
    JOIN LATERAL (
      SELECT sum(lift) AS score
      FROM public.event_covis cv
      WHERE cv.e1 IN (
        SELECT event_id
        FROM public.user_event_interactions
        WHERE user_id = p_user
        ORDER BY created_at DESC
        LIMIT 10
      )
      AND cv.e2 = e.id
    ) c ON true
    WHERE e.start_at > now()
  ),
  pop AS (
    SELECT event_id, count(*)::double precision AS pop
    FROM public.user_event_interactions
    WHERE created_at > now() - interval '30 days'
    GROUP BY 1
  ),
  cand AS (
    SELECT DISTINCT ON (event_id)
      x.event_id, x.title, x.category, x.start_at, x.geog,
      COALESCE(sim,0) AS sim, COALESCE(co_vis,0) AS co_vis
    FROM (
      SELECT * FROM content
      UNION ALL
      SELECT * FROM covis
    ) x
  )
  SELECT
    cand.event_id,
    cand.title,
    cand.category,
    cand.start_at,
    CASE WHEN (SELECT base_geog FROM u) IS NOT NULL
      THEN ST_DistanceSphere(cand.geog, (SELECT base_geog FROM u)) / 1000.0
      ELSE null END AS distance_km,
    (
      0.55 * cand.sim
    + 0.30 * cand.co_vis
    + 0.10 * COALESCE(pop.pop, 0)
    + 0.05 * CASE WHEN cand.start_at > now() THEN 1 ELSE 0 END
    )
    * CASE WHEN (SELECT base_geog FROM u) IS NOT NULL
            THEN exp( - (ST_DistanceSphere(cand.geog, (SELECT base_geog FROM u)) / 1000.0)
                       / NULLIF((SELECT radius_km FROM u) * 0.6, 0) )
           ELSE 1 END
    AS score
  FROM cand
  LEFT JOIN pop ON pop.event_id = cand.event_id
  WHERE cand.start_at > now()
    AND ( (SELECT base_geog FROM u) IS NULL
          OR ST_DWithin(cand.geog, (SELECT base_geog FROM u), (SELECT radius_km FROM u) * 3000) )
  ORDER BY score DESC, cand.start_at ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_recommendations(uuid, int) TO anon, authenticated;

-- RPC: similar events (item-to-item, useful for "because you viewed …")
CREATE OR REPLACE FUNCTION public.similar_events(
  p_event uuid,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  event_id uuid,
  title text,
  starts_at timestamptz,
  score double precision
) LANGUAGE sql STABLE AS $$
  WITH content AS (
    SELECT e2.id, e2.title, e2.start_at,
      (1 - (e1.embedding <=> e2.embedding))::double precision AS sim
    FROM public.events e1
    JOIN public.events e2 ON e1.id <> e2.id
    WHERE e1.id = p_event AND e1.embedding IS NOT NULL AND e2.embedding IS NOT NULL
  ),
  covis AS (
    SELECT e2 AS id, sum(lift) AS co_vis
    FROM public.event_covis
    WHERE e1 = p_event
    GROUP BY 1
  ),
  pop AS (
    SELECT event_id AS id, count(*)::double precision AS pop
    FROM public.user_event_interactions
    WHERE created_at > now() - interval '30 days'
    GROUP BY 1
  )
  SELECT c.id AS event_id, e.title, e.start_at,
         (0.7*COALESCE(c.sim,0) + 0.25*COALESCE(cv.co_vis,0) + 0.05*COALESCE(p.pop,0)) AS score
  FROM content c
  JOIN public.events e ON e.id = c.id
  LEFT JOIN covis cv ON cv.id = c.id
  LEFT JOIN pop p ON p.id = c.id
  WHERE e.start_at > now()
  ORDER BY score DESC, e.start_at ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.similar_events(uuid, int) TO anon, authenticated;

-- Enable RLS on new tables
ALTER TABLE public.user_event_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies for interactions
CREATE POLICY "Users can insert own interactions" ON public.user_event_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own interactions" ON public.user_event_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Event managers can view event interactions" ON public.user_event_interactions
  FOR SELECT USING (is_event_manager(event_id));

-- RLS policies for embeddings
CREATE POLICY "Users can view own embeddings" ON public.user_embeddings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage embeddings" ON public.user_embeddings
  FOR ALL USING (true);