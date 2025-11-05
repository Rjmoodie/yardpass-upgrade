-- 20250105_enable_rls_internal_tables.sql
-- Fixes rule 0013_rls_disabled_in_public for internal/system tables
-- These tables are not meant for direct client access

-- 1) Turn on RLS
ALTER TABLE public.model_feature_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;

-- 2) Block all direct access from anon/authenticated
-- (service_role bypasses RLS, so your backend still works)

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
-- EFFECT:
-- - Client roles (anon, authenticated) will see 0 rows and can't modify data
-- - Backend using service_role key still works (service_role bypasses RLS)
-- - Supabase Advisor will stop complaining about these two tables
-- ==============================================================================




