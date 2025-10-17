-- =====================================================
-- PGBENCH Script: Ticket Reservation
-- =====================================================
-- This script is used by pgbench to test concurrent reservations
--
-- Usage:
-- 1. Replace TIER_ID below with your actual tier ID
-- 2. Run from terminal with pgbench
--
-- Example:
-- pgbench -f tests/load/pgbench-reserve.sql -n -c 50 -j 10 -T 30 -r \
--   postgresql://postgres:password@db.project.supabase.co:5432/postgres
--
-- =====================================================

-- Replace this with your actual tier ID from the setup
\set tier_id 'PASTE_YOUR_TIER_ID_HERE'
\set qty 2

BEGIN;

SELECT reserve_tickets_batch(
  p_reservations := jsonb_build_array(
    jsonb_build_object(
      'tier_id', :'tier_id'::uuid,
      'quantity', :qty
    )
  ),
  p_session_id := 'pgbench-' || :client_id || '-' || :scale || '-' || extract(epoch from now())::text,
  p_expires_minutes := 10
);

COMMIT;


