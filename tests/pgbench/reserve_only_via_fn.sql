\set TIERS_N        50         -- set to count(*) from pgbench_tiers
\set MAX_PER_ORDER  6
\set QTY            1

-- choose a tier by position and a fresh session id
\set pos   random(1, :TIERS_N)

-- Generate a short random session id (UUID works too)
SELECT encode(gen_random_bytes(8), 'hex') AS session_id \gset

BEGIN;

-- Call the function and capture the "success" boolean from returned JSONB
SELECT COALESCE((reserve_tickets_atomic(
  (SELECT id FROM public.pgbench_tiers WHERE pos = :pos),
  :QTY,
  :'session_id'
)->>'success')::boolean, false) AS ok \gset

\if :ok
  COMMIT;
\else
  ROLLBACK;
\endif