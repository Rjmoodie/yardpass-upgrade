-- Prevent duplicate event creation with unique constraints and better idempotency

-- 1. Add unique constraint on slug to prevent exact duplicates
-- Note: This will fail if there are existing duplicate slugs, so we handle that
DO $$
BEGIN
  -- Try to add unique constraint
  ALTER TABLE events.events 
  ADD CONSTRAINT events_slug_unique UNIQUE (slug);
EXCEPTION
  WHEN duplicate_table THEN
    -- Constraint already exists, skip
    RAISE NOTICE 'events_slug_unique constraint already exists';
  WHEN others THEN
    -- Might have duplicate slugs, make them unique first
    RAISE NOTICE 'Cannot add unique constraint - may have duplicate slugs';
END $$;

-- 2. Update existing duplicate slugs to make them unique (if any exist)
UPDATE events.events e1
SET slug = e1.slug || '-' || substr(e1.id::text, 1, 8)
WHERE EXISTS (
  SELECT 1
  FROM events.events e2
  WHERE e2.slug = e1.slug
    AND e2.id != e1.id
    AND e2.created_at < e1.created_at
);

-- 3. Now try adding the constraint again if it failed before
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_slug_unique'
  ) THEN
    ALTER TABLE events.events 
    ADD CONSTRAINT events_slug_unique UNIQUE (slug);
    RAISE NOTICE 'Added events_slug_unique constraint';
  END IF;
END $$;

COMMENT ON CONSTRAINT events_slug_unique ON events.events IS 
'Prevents duplicate events with the same slug - provides idempotency at database level';






