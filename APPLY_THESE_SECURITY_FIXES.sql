-- ==============================================================================
-- YARDPASS SECURITY & PERFORMANCE FIXES
-- ==============================================================================
-- This file consolidates all security and performance migrations
-- Safe to run multiple times (all operations check for existence)
--
-- Run this in Supabase SQL Editor or via: supabase db push
-- ==============================================================================

-- ==============================================================================
-- 1. ENABLE RLS ON INTERNAL TABLES
-- ==============================================================================
-- Fixes: 0013_rls_disabled_in_public for model_feature_weights and outbox

ALTER TABLE public.model_feature_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'model_feature_weights'
      AND policyname = 'no direct access model_feature_weights'
  ) THEN
    CREATE POLICY "no direct access model_feature_weights"
      ON public.model_feature_weights
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'outbox'
      AND policyname = 'no direct access outbox'
  ) THEN
    CREATE POLICY "no direct access outbox"
      ON public.outbox
      FOR ALL
      USING (false)
      WITH CHECK (false);
  END IF;
END$$;

-- ==============================================================================
-- 2. DROP DUPLICATE INDEXES
-- ==============================================================================
-- Fixes: Performance warnings about duplicate/overlapping indexes

-- kv_store_d42c04e8 duplicates
DROP INDEX IF EXISTS public.kv_store_d42c04e8_key_idx1;
DROP INDEX IF EXISTS public.kv_store_d42c04e8_key_idx2;

-- sponsor_profiles duplicates
DROP INDEX IF EXISTS public.idx_sp_profile_industry_size;
DROP INDEX IF EXISTS public.idx_sprof_industry_size;
DROP INDEX IF EXISTS public.idx_sp_profile_categories;
DROP INDEX IF EXISTS public.idx_sprof_categories;
DROP INDEX IF EXISTS public.idx_sp_profile_regions;
DROP INDEX IF EXISTS public.idx_sprof_regions;

-- sponsor_public_profiles duplicate
DROP INDEX IF EXISTS public.idx_sponsor_public_profiles_verified;

-- match_features duplicate
DROP INDEX IF EXISTS public.idx_match_features_event_sponsor_ver;

-- sponsorship_matches duplicates
DROP INDEX IF EXISTS public.idx_match_event_score;
DROP INDEX IF EXISTS public.idx_match_status_updated;
DROP INDEX IF EXISTS public.idx_match_status_utime;

-- proposal_messages duplicate
DROP INDEX IF EXISTS public.idx_prop_msgs_thread_time;

-- ==============================================================================
-- 3. LOCK DOWN MATERIALIZED VIEWS & ANALYTICS TABLES
-- ==============================================================================
-- Fixes: 0016_materialized_view_in_api warnings

DO $$
DECLARE
  obj text;
  relkind_char char(1);
BEGIN
  -- List of analytics-style relations in public we want to lock down
  FOREACH obj IN ARRAY ARRAY[
    'analytics_campaign_daily_mv',
    'event_video_kpis_daily',
    'mv_event_quality_scores',
    'mv_event_reach_snapshot',
    'mv_sponsorship_revenue',
    'trending_posts',
    'user_event_affinity',
    'event_covis'
  ]
  LOOP
    SELECT relkind
    INTO relkind_char
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = obj;

    IF FOUND THEN
      -- Remove all API-role access
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', obj);

      -- Allow only backend/server key to read them
      EXECUTE format('GRANT SELECT ON public.%I TO service_role;', obj);
      
      RAISE NOTICE 'Locked down: public.%', obj;
    ELSE
      RAISE NOTICE 'Skipped (not found): public.%', obj;
    END IF;
  END LOOP;
END$$;

-- ==============================================================================
-- 4. ADD POLICIES TO TABLES WITH RLS BUT NO POLICIES
-- ==============================================================================

DO $$
DECLARE
  tbl text;
  policy_name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'audience_consents',
    'deliverable_proofs',
    'deliverables',
    'fit_recalc_queue',
    'match_features',
    'match_feedback',
    'package_variants',
    'proposal_messages',
    'proposal_threads',
    'sponsorship_slas'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = tbl
    ) THEN
      policy_name := tbl || '_service_role';
      
      -- Check if policy already exists
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = tbl 
        AND policyname = policy_name
      ) THEN
        -- Create service_role-only policy
        EXECUTE format(
          'CREATE POLICY "%I"
           ON public.%I FOR ALL
           TO service_role
           USING (true)
           WITH CHECK (true)',
          policy_name, tbl
        );
        
        RAISE NOTICE 'Added policy to: public.%', tbl;
      ELSE
        RAISE NOTICE 'Policy already exists for: public.%', tbl;
      END IF;
    ELSE
      RAISE NOTICE 'Skipped (not found): public.%', tbl;
    END IF;
  END LOOP;
END$$;

-- ==============================================================================
-- 5. HANDLE CROSS-SCHEMA TABLES
-- ==============================================================================

DO $$
DECLARE
  schema_name text;
  table_name text;
  policy_name text;
BEGIN
  FOR schema_name, table_name IN
    VALUES 
      ('analytics', 'audience_consents'),
      ('sponsorship', 'deliverable_proofs'),
      ('sponsorship', 'fit_recalc_queue'),
      ('sponsorship', 'match_features'),
      ('sponsorship', 'match_feedback'),
      ('sponsorship', 'package_variants'),
      ('sponsorship', 'proposal_messages'),
      ('sponsorship', 'sponsorship_slas'),
      ('payments', 'payout_queue')
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = schema_name 
      AND tablename = table_name
    ) THEN
      policy_name := schema_name || '_' || table_name || '_service_role';
      
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = schema_name 
        AND tablename = table_name 
        AND policyname = policy_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY "%I"
           ON %I.%I FOR ALL
           TO service_role
           USING (true)
           WITH CHECK (true)',
          policy_name, schema_name, table_name
        );
        
        RAISE NOTICE 'Added policy to: %.%', schema_name, table_name;
      ELSE
        RAISE NOTICE 'Policy already exists for: %.%', schema_name, table_name;
      END IF;
    END IF;
  END LOOP;
END$$;

-- ==============================================================================
-- COMPLETE! 🎉
-- ==============================================================================
-- Next Steps:
-- 1. Verify all migrations applied successfully (check NOTICES)
-- 2. Run Supabase Database Linter to confirm warnings are reduced
-- 3. Test that the app still works (especially analytics dashboards)
--
-- Expected Results:
-- ✅ 0013_rls_disabled_in_public - FIXED (2 tables)
-- ✅ Duplicate index warnings - REDUCED (11 indexes dropped)
-- ✅ 0016_materialized_view_in_api - FIXED (8 views locked down)
-- ⚠️  0010_security_definer_view - INTENTIONAL (see SECURITY_DEFINER_VIEWS_RATIONALE.md)
-- ==============================================================================
