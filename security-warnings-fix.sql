-- ============================================================================
-- FIX SECURITY ADVISOR WARNINGS - Functions & Best Practices
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: Fix Function Search Path (Prevents search_path injection attacks)
-- ============================================================================

-- Set search_path for all public functions to prevent injection
-- This approach dynamically finds all function signatures and applies the fix

DO $$
DECLARE
  func_names text[] := ARRAY[
    'can_view_event',
    'tg_assign_serial_no', 
    'get_feed_item_for_post',
    'claim_order_ticketing',
    'gen_qr_code',
    'trg_event_reactions_bump_counts',
    'update_sponsorship_orders_updated_at',
    'update_post_like_count',
    'normalize_text',
    'test_like_trigger',
    'is_service_role',
    'trg_event_comments_bump_counts',
    'get_home_feed_ids',
    'set_updated_at',
    'get_home_feed_ids_v2',
    'get_event_posts_cursor_v2',
    'user_related_event_ids',
    'touch_search_docs_mv',
    'search_all',
    'validate_social_links'
  ];
  func_name text;
  func_signature text;
  alter_cmd text;
BEGIN
  -- Loop through each function name
  FOREACH func_name IN ARRAY func_names
  LOOP
    -- Find all functions with this name and update them
    FOR func_signature IN 
      SELECT oid::regprocedure::text
      FROM pg_proc 
      WHERE proname = func_name 
        AND pronamespace = 'public'::regnamespace
    LOOP
      -- Build and execute ALTER FUNCTION command
      alter_cmd := format('ALTER FUNCTION %s SET search_path = public', func_signature);
      
      BEGIN
        EXECUTE alter_cmd;
        RAISE NOTICE 'Updated function: %', func_signature;
      EXCEPTION 
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to update function: % - Error: %', func_signature, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Note: If you get "function does not exist" errors, that function may have parameters.
-- You can check with: SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'function_name';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that functions now have search_path set
SELECT 
  p.proname as function_name,
  CASE 
    WHEN p.proconfig IS NULL THEN '❌ Not Set'
    ELSE '✅ Set: ' || array_to_string(p.proconfig, ', ')
  END as search_path_status
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN (
    'can_view_event',
    'tg_assign_serial_no', 
    'get_feed_item_for_post',
    'claim_order_ticketing',
    'gen_qr_code',
    'trg_event_reactions_bump_counts',
    'update_sponsorship_orders_updated_at',
    'update_post_like_count',
    'normalize_text',
    'test_like_trigger',
    'is_service_role',
    'trg_event_comments_bump_counts',
    'get_home_feed_ids',
    'set_updated_at',
    'get_home_feed_ids_v2',
    'get_event_posts_cursor_v2',
    'user_related_event_ids',
    'touch_search_docs_mv',
    'search_all',
    'validate_social_links'
  )
ORDER BY function_name;

