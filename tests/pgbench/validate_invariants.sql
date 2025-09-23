-- Must-pass invariants to run during/after load testing

-- A) Availability never negative
SELECT id, total_quantity, reserved_quantity, issued_quantity,
       total_quantity - reserved_quantity - issued_quantity AS available
FROM public.ticket_tiers
WHERE (total_quantity - reserved_quantity - issued_quantity) < 0;

-- Expect: 0 rows

-- B) Never oversold
SELECT id
FROM public.ticket_tiers
WHERE (reserved_quantity + issued_quantity) > total_quantity;

-- Expect: 0 rows

-- C) Snapshot sanity for your test cohort
SELECT
  count(*)                                AS tiers,
  sum(total_quantity)                     AS total,
  sum(reserved_quantity)                  AS reserved,
  sum(issued_quantity)                    AS issued,
  sum(total_quantity - reserved_quantity - issued_quantity) AS available
FROM public.ticket_tiers
-- Narrow if you use a cohort naming:
-- WHERE name LIKE 'pgb-%'
;