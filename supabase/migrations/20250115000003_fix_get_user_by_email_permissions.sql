-- Fix permissions for get_user_id_by_email RPC
-- Grant to anon and authenticated roles (Edge Functions need this)
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email TO anon, authenticated;

-- Also add a simpler test query to verify it works
COMMENT ON FUNCTION public.get_user_id_by_email IS 'Returns user_id for email. Accessible by anon, authenticated, and service_role.';

