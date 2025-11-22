-- ============================================================
-- Diagnostic Script: Check ticket_tiers Schema State
-- ============================================================
-- Purpose: Verify what columns exist in ticketing.ticket_tiers
--          and what the public.ticket_tiers view includes
-- ============================================================

-- 1. Check if the column exists in the base table
SELECT 
  'ticketing.ticket_tiers TABLE COLUMNS' as check_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'ticketing'
  AND table_name = 'ticket_tiers'
  AND column_name = 'is_rsvp_only';

-- 2. Check all columns in ticketing.ticket_tiers table
SELECT 
  'ALL COLUMNS IN ticketing.ticket_tiers' as info_type,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'ticketing'
  AND table_name = 'ticket_tiers'
ORDER BY ordinal_position;

-- 3. Check if public.ticket_tiers view exists
SELECT 
  'VIEW EXISTS' as check_type,
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'ticket_tiers';

-- 4. Check what columns the view includes (via definition)
SELECT 
  'VIEW DEFINITION' as check_type,
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'ticket_tiers';

-- 5. Check if is_rsvp_only appears in view columns (via information_schema)
SELECT 
  'VIEW COLUMNS' as check_type,
  column_name
FROM information_schema.view_column_usage
WHERE view_schema = 'public'
  AND view_name = 'ticket_tiers'
  AND table_schema = 'ticketing'
  AND table_name = 'ticket_tiers'
  AND column_name = 'is_rsvp_only';

-- 6. Get all columns that the view references
SELECT 
  'ALL VIEW COLUMN REFERENCES' as info_type,
  column_name,
  table_schema,
  table_name
FROM information_schema.view_column_usage
WHERE view_schema = 'public'
  AND view_name = 'ticket_tiers'
ORDER BY 
  CASE column_name
    WHEN 'id' THEN 1
    WHEN 'event_id' THEN 2
    WHEN 'name' THEN 3
    ELSE 99
  END;

-- 7. Try to query the view directly (this will show if column exists)
-- SELECT 
--   'TEST VIEW QUERY' as test,
--   id,
--   name,
--   is_rsvp_only
-- FROM public.ticket_tiers
-- LIMIT 1;

-- 8. Try to query the table directly (this will show if column exists)
-- SELECT 
--   'TEST TABLE QUERY' as test,
--   id,
--   name,
--   is_rsvp_only
-- FROM ticketing.ticket_tiers
-- LIMIT 1;

-- ============================================================
-- Summary Check
-- ============================================================

-- Quick check: Does column exist in table?
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ticketing'
      AND table_name = 'ticket_tiers'
      AND column_name = 'is_rsvp_only'
  ) THEN
    RAISE NOTICE '✅ Column is_rsvp_only EXISTS in ticketing.ticket_tiers';
  ELSE
    RAISE NOTICE '❌ Column is_rsvp_only DOES NOT EXIST in ticketing.ticket_tiers';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'ticket_tiers'
  ) THEN
    RAISE NOTICE '✅ View public.ticket_tiers EXISTS';
    
    -- Check if view definition mentions is_rsvp_only
    IF EXISTS (
      SELECT 1 FROM pg_views
      WHERE schemaname = 'public'
        AND viewname = 'ticket_tiers'
        AND definition ILIKE '%is_rsvp_only%'
    ) THEN
      RAISE NOTICE '✅ View public.ticket_tiers INCLUDES is_rsvp_only in definition';
    ELSE
      RAISE NOTICE '❌ View public.ticket_tiers DOES NOT include is_rsvp_only in definition';
    END IF;
  ELSE
    RAISE NOTICE '❌ View public.ticket_tiers DOES NOT EXIST';
  END IF;
END $$;

