-- ============================================
-- Enhanced user authentication method check
-- Now properly distinguishes guest checkout vs organic signup
-- ============================================

CREATE OR REPLACE FUNCTION public.check_user_auth_method(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_has_password boolean;
  v_created_via text;
  v_email_confirmed boolean;
  v_account_type text;
BEGIN
  -- Look up user in auth.users by email
  SELECT 
    id,
    encrypted_password IS NOT NULL AND encrypted_password != '',
    raw_user_meta_data->>'created_via',
    email_confirmed_at IS NOT NULL
  INTO 
    v_user_id,
    v_has_password,
    v_created_via,
    v_email_confirmed
  FROM auth.users
  WHERE email = LOWER(TRIM(p_email))
    AND deleted_at IS NULL
    AND banned_until IS NULL;

  -- User doesn't exist
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'exists', false,
      'has_password', false,
      'account_type', 'new',
      'created_via', null,
      'email_confirmed', false,
      'is_guest_checkout', false
    );
  END IF;

  -- ✅ CRITICAL: Prioritize guest checkout origin over password status
  -- Guests who bought tickets should ALWAYS get passwordless flow
  IF v_created_via = 'guest_checkout' THEN
    v_account_type := 'guest-checkout';  -- ✅ Guest checkout (even if password exists)
  ELSIF v_has_password THEN
    v_account_type := 'password';  -- ✅ Organic user with password
  ELSE
    v_account_type := 'organic-passwordless';  -- ✅ Organic signup, no password yet
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'has_password', v_has_password,
    'account_type', v_account_type,
    'created_via', v_created_via,
    'email_confirmed', v_email_confirmed,
    'is_guest_checkout', v_created_via = 'guest_checkout'  -- ✅ Boolean flag
  );
END;
$$;

-- Grant remains the same
GRANT EXECUTE ON FUNCTION public.check_user_auth_method(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_auth_method(text) TO anon;

COMMENT ON FUNCTION public.check_user_auth_method IS 
'Enhanced to distinguish guest checkout users from organic passwordless signups using created_via metadata.';

