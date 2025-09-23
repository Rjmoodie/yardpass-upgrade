-- Map a cohort of tiers into a fixed ordinal list for pgbench to sample.
-- Adjust the WHERE to select your real tiers (or remove to include all).
DROP TABLE IF EXISTS public.pgbench_tiers;
CREATE TABLE public.pgbench_tiers (
  pos int PRIMARY KEY,
  id  uuid NOT NULL REFERENCES public.ticket_tiers(id)
);

INSERT INTO public.pgbench_tiers (pos, id)
SELECT row_number() OVER ()::int AS pos, id
FROM public.ticket_tiers
-- Narrow to a test cohort if desired:
-- WHERE name LIKE 'pgb-%'
ORDER BY created_at DESC;

-- Handy index (usually not needed, but cheap):
CREATE INDEX IF NOT EXISTS idx_pgbench_tiers_id ON public.pgbench_tiers(id);

SELECT count(*) AS mapped_tiers FROM public.pgbench_tiers;