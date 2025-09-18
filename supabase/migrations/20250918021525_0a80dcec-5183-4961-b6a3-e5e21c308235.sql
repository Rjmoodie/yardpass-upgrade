-- Drop and recreate the search_all function with proper permissions
DROP FUNCTION IF EXISTS public.search_all(uuid, text, text, timestamptz, timestamptz, boolean, integer, integer);

CREATE OR REPLACE FUNCTION public.search_all(
  p_user uuid, 
  p_q text, 
  p_category text DEFAULT NULL, 
  p_date_from timestamptz DEFAULT NULL, 
  p_date_to timestamptz DEFAULT NULL, 
  p_only_events boolean DEFAULT false, 
  p_limit integer DEFAULT 20, 
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
      -- hybrid score: ts_rank + trigram similarities + recency boost
      COALESCE(ts_rank(b.ts, (SELECT tq FROM q)), 0)
      + GREATEST(similarity(normalize_text(b.title), (SELECT nq FROM q)), 0) * 0.6
      + GREATEST(similarity(normalize_text(b.body),  (SELECT nq FROM q)), 0) * 0.25
      + GREATEST(similarity(normalize_text(b.location),(SELECT nq FROM q)),0) * 0.15
      + CASE WHEN b.starts_at >= now() THEN 0.15 ELSE 0 END
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

-- Grant proper permissions
GRANT EXECUTE ON FUNCTION public.search_all TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_all TO anon;