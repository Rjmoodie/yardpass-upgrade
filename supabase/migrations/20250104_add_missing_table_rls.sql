-- Add RLS to tables that are missing it (definite security issues)

-- 1. model_feature_weights - ML model configuration table
-- This should only be writable by service_role, but readable by authenticated users
ALTER TABLE public.model_feature_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_feature_weights_read_authenticated"
ON public.model_feature_weights
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "model_feature_weights_manage_service_role"
ON public.model_feature_weights
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "model_feature_weights_read_authenticated" ON public.model_feature_weights IS
'Authenticated users can read model weights for recommendations';

-- 2. outbox - Message queue/outbox pattern table
-- This should only be accessible by service_role (background workers)
ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outbox_service_role_only"
ON public.outbox
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "outbox_service_role_only" ON public.outbox IS
'Only service_role (background workers) can access the outbox table';

-- Note: No policy for authenticated/anon users - they should not access outbox directly





