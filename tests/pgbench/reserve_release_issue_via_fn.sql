\set TIERS_N        50          -- set to count(*) from pgbench_tiers
\set MAX_PER_ORDER  6
\set QTY            1
\set RELEASE_PCT    35          -- % of successful reserves that will be released (abandoned)

\set pos random(1, :TIERS_N)
\set r   random(1, 100)

SELECT encode(gen_random_bytes(8), 'hex') AS session_id \gset

BEGIN;

-- 1) Reserve via your function
SELECT COALESCE((reserve_tickets_atomic(
  (SELECT id FROM public.pgbench_tiers WHERE pos = :pos),
  :QTY,
  :'session_id'
)->>'success')::boolean, false) AS ok \gset

\if :ok
  -- 2) Decide path
  \if :r <= :RELEASE_PCT
    -- RELEASE via your function
    SELECT COALESCE((release_tickets_atomic(
      (SELECT id FROM public.pgbench_tiers WHERE pos = :pos),
      :QTY
    )->>'success')::boolean, false) AS rel_ok \gset

    \if :rel_ok
      COMMIT;
    \else
      ROLLBACK;
    \endif

  \else
    -- ISSUE (purchase completes): guarded inline UPDATE
    -- Moves reserved -> issued only if enough is reserved
    UPDATE public.ticket_tiers AS t
    SET reserved_quantity = t.reserved_quantity - :QTY,
        issued_quantity   = t.issued_quantity   + :QTY
    WHERE t.id = (SELECT id FROM public.pgbench_tiers WHERE pos = :pos)
      AND t.reserved_quantity >= :QTY;

    \if :rowcount = 0
      -- if this ever fails, roll back the whole tx to keep invariants clean
      ROLLBACK;
    \else
      COMMIT;
    \endif
  \endif

\else
  -- reservation failed (sold out or guard) -> nothing to do
  ROLLBACK;
\endif