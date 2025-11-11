-- Fix missing INSERT, UPDATE, DELETE permissions on public.events view
-- Issue: Users get 403 when trying to create events because the view only has SELECT permission

-- Grant all necessary permissions on the events view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT ALL ON public.events TO service_role;

-- Also ensure the underlying table has proper RLS policies (should already be there)
-- The RLS policies on events.events will still be enforced

COMMENT ON VIEW public.events IS 'View of events.events with full CRUD permissions for authenticated users. RLS policies are enforced on the underlying table.';





