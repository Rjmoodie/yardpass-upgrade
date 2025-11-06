-- RPC function to get user_id by email (bypasses pagination)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id TEXT;
BEGIN
  -- Query auth.users directly by email
  SELECT id::TEXT INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(p_email)
  LIMIT 1;
  
  RETURN v_user_id;
END;
$$;

COMMENT ON FUNCTION public.get_user_id_by_email IS 'Returns user_id for a given email address, bypassing listUsers pagination';

-- Grant execute to service role (Edge Functions)
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email TO service_role;

