-- Smart search system for events platform
-- 1) Extensions for fuzzy search 
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Helper: normalized text (strip accents, lower)
CREATE OR REPLACE FUNCTION public.normalize_text(txt text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(unaccent(COALESCE(txt,'')));
$$;

-- 3) Search source (adapt table/column names to match your schema)
-- We'll index upcoming events and event posts
CREATE OR REPLACE VIEW public.search_docs AS
WITH ev AS (
  SELECT
    'event'::text                         AS kind,
    e.id                                  AS item_id,
    e.title                               AS title,
    COALESCE(e.description,'')            AS body,
    e.start_at                            AS starts_at,
    e.category                            AS category,
    COALESCE(e.city, e.venue, '')         AS location,
    e.created_by                          AS organizer_id,
    null::uuid                            AS post_id
  FROM public.events e
),
post AS (
  SELECT
    'post'::text                          AS kind,
    p.event_id                            AS item_id,   -- navigate to its event
    COALESCE(e.title, 'Event')            AS title,     -- show event title
    COALESCE(p.text,'')                   AS body,
    e.start_at                            AS starts_at,
    e.category                            AS category,
    COALESCE(e.city, e.venue, '')         AS location,
    e.created_by                          AS organizer_id,
    p.id                                  AS post_id
  FROM public.event_posts p
  LEFT JOIN public.events e ON e.id = p.event_id
  WHERE p.deleted_at IS NULL
)
SELECT * FROM ev
UNION ALL
SELECT * FROM post;

-- 4) Materialized tsvector for speed (optional but recommended)
DROP MATERIALIZED VIEW IF EXISTS public.search_docs_mv CASCADE;
CREATE MATERIALIZED VIEW public.search_docs_mv AS
SELECT
  kind,
  item_id,
  post_id,
  title,
  body,
  starts_at,
  category,
  location,
  organizer_id,
  -- Weighted ts: title gets higher weight
  setweight(to_tsvector('simple', normalize_text(title)), 'A') ||
  setweight(to_tsvector('simple', normalize_text(body)),  'B') AS ts
FROM public.search_docs;

CREATE INDEX ON public.search_docs_mv USING gin(ts);
CREATE INDEX ON public.search_docs_mv USING gin (normalize_text(title) gin_trgm_ops);
CREATE INDEX ON public.search_docs_mv USING gin (normalize_text(body) gin_trgm_ops);
CREATE INDEX ON public.search_docs_mv (starts_at);
CREATE INDEX ON public.search_docs_mv (category);
CREATE INDEX ON public.search_docs_mv (kind);
CREATE INDEX ON public.search_docs_mv USING gin (normalize_text(location) gin_trgm_ops);

-- Refresh helper
CREATE OR REPLACE FUNCTION public.refresh_search_docs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.search_docs_mv;
EXCEPTION WHEN feature_not_supported THEN
  REFRESH MATERIALIZED VIEW public.search_docs_mv;
END;
$$;

-- 5) Main RPC: fuzzy + full-text + filters + ranking
CREATE OR REPLACE FUNCTION public.search_all(
  p_user uuid,                -- for future personalization (not used yet)
  p_q text,
  p_category text DEFAULT null,
  p_date_from timestamptz DEFAULT null,
  p_date_to   timestamptz DEFAULT null,
  p_only_events boolean DEFAULT false,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  kind text,
  item_id uuid,
  post_id uuid,
  title text,
  snippet text,
  starts_at timestamptz,
  category text,
  location text,
  score numeric
)
LANGUAGE sql STABLE AS $$
  WITH q AS (
    SELECT
      normalize_text(COALESCE(p_q,'')) AS nq,
      plainto_tsquery('simple', normalize_text(COALESCE(p_q,''))) AS tq
  ),
  base AS (
    SELECT d.*
    FROM public.search_docs_mv d, q
    WHERE
      (q.nq = '' OR d.ts @@ q.tq
       OR normalize_text(d.title) % q.nq
       OR normalize_text(d.body)  % q.nq
       OR normalize_text(d.location) % q.nq)
      AND (p_category IS NULL OR d.category = p_category)
      AND (p_date_from IS NULL OR d.starts_at >= p_date_from)
      AND (p_date_to   IS NULL OR d.starts_at <  p_date_to)
      AND (NOT p_only_events OR d.kind = 'event')
  ),
  ranked AS (
    SELECT
      b.*,
      -- hybrid score: ts_rank + trigram similarities
      COALESCE(ts_rank(b.ts, (SELECT tq FROM q)), 0)
      + GREATEST(similarity(normalize_text(b.title), (SELECT nq FROM q)), 0) * 0.6
      + GREATEST(similarity(normalize_text(b.body),  (SELECT nq FROM q)), 0) * 0.25
      + GREATEST(similarity(normalize_text(b.location),(SELECT nq FROM q)),0) * 0.15
      + CASE WHEN b.starts_at >= now() THEN 0.15 ELSE 0 END  -- preference for upcoming
      AS score
    FROM base b
  )
  SELECT
    kind, item_id, post_id, title,
    left(COALESCE(body,''), 180) AS snippet,
    starts_at, category, location, score
  FROM ranked
  ORDER BY score DESC, starts_at ASC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
$$;

-- 6) Permissions
REVOKE ALL ON FUNCTION public.search_all(uuid, text, text, timestamptz, timestamptz, boolean, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.search_all(uuid, text, text, timestamptz, timestamptz, boolean, int, int) TO anon, authenticated;

-- 7) Keep MV in sync (simple trigger approach)
CREATE OR REPLACE FUNCTION public.touch_search_docs_mv()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_search_docs();
  RETURN null;
END;
$$;

DROP TRIGGER IF EXISTS refresh_search_docs_events ON public.events;
CREATE TRIGGER refresh_search_docs_events
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH STATEMENT EXECUTE PROCEDURE public.touch_search_docs_mv();

DROP TRIGGER IF EXISTS refresh_search_docs_posts ON public.event_posts;
CREATE TRIGGER refresh_search_docs_posts
AFTER INSERT OR UPDATE OR DELETE ON public.event_posts
FOR EACH STATEMENT EXECUTE PROCEDURE public.touch_search_docs_mv();