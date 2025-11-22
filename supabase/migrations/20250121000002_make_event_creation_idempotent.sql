-- ============================================================
-- Make Event Creation Idempotent
-- ============================================================
-- Purpose: Allow retrying event creation safely - duplicate requests
--          with same idempotency key return existing event instead of erroring
-- ============================================================

-- 1. Add idempotency_key column to events table
ALTER TABLE events.events 
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

COMMENT ON COLUMN events.events.idempotency_key IS 
'Client-generated UUID for idempotency. Duplicate requests with same key return existing event instead of creating duplicate.';

-- 2. Add index for fast idempotency key lookups
CREATE INDEX IF NOT EXISTS idx_events_idempotency_key 
ON events.events(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- 3. Create unique constraint on idempotency_key (only for non-null values)
-- This allows idempotency checks while still allowing events without keys
CREATE UNIQUE INDEX IF NOT EXISTS events_idempotency_key_unique 
ON events.events(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Add comment on index (index is in events schema, same as table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'events_idempotency_key_unique'
      AND n.nspname = 'events'
  ) THEN
    EXECUTE 'COMMENT ON INDEX events.events_idempotency_key_unique IS ''Ensures idempotency - duplicate idempotency keys cannot create multiple events''';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors when commenting on index
    NULL;
END $$;

-- 4. Create helper function to check for existing event by idempotency key
CREATE OR REPLACE FUNCTION public.get_event_by_idempotency_key(p_idempotency_key TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'events'
AS $$
  SELECT id
  FROM events.events
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_by_idempotency_key(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_event_by_idempotency_key IS 
'Check if event with given idempotency key exists. Returns event ID if exists, NULL if new. Use before INSERT for idempotency.';

-- ============================================================
-- Migration Complete
-- ============================================================
-- Event creation is now idempotent via idempotency_key column.
-- Application should:
-- 1. Generate UUID as idempotency key
-- 2. Include it in INSERT
-- 3. Use ON CONFLICT (idempotency_key) DO UPDATE to handle duplicates
--    OR check for existing event before inserting

