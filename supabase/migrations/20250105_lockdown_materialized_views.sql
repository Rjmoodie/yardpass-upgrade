-- 20250105_lockdown_materialized_views.sql
-- Restrict analytics materialized views / tables from API roles
-- Silences "0016_materialized_view_in_api" security warnings

-- Helper DO block: revoke from anon/authenticated if the relation exists
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
      -- (service_role is the Supabase role used by the service key)
      EXECUTE format('GRANT SELECT ON public.%I TO service_role;', obj);
      
      RAISE NOTICE 'Locked down: public.%', obj;
    ELSE
      RAISE NOTICE 'Skipped (not found): public.%', obj;
    END IF;
  END LOOP;
END$$;

-- ==============================================================================
-- TABLES WITH RLS BUT NO POLICIES - Add Service-Role-Only Access
-- ==============================================================================
-- These tables have RLS enabled but no policies (shows up as INFO warnings)
-- They're likely used by background jobs, so we'll allow service_role only

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
-- CROSS-SCHEMA TABLES (analytics, sponsorship, payments schemas)
-- ==============================================================================

DO $$
DECLARE
  schema_name text;
  table_name text;
  policy_name text;
BEGIN
  -- Array of (schema, table) pairs
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
      
      -- Check if policy already exists
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
-- RESULT: Materialized view warnings silenced, internal tables protected
-- ==============================================================================


