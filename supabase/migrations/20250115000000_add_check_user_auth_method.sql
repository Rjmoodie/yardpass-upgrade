-- ============================================
-- Function to check user's authentication method
-- Used by SmartAuthModal to detect account type
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
      'email_confirmed', false
    );
  END IF;

  -- Determine account type
  RETURN jsonb_build_object(
    'exists', true,
    'has_password', v_has_password,
    'account_type', CASE
      WHEN v_has_password THEN 'password'
      WHEN v_created_via = 'guest_checkout' THEN 'guest'
      ELSE 'passwordless'
    END,
    'created_via', v_created_via,
    'email_confirmed', v_email_confirmed
  );
END;
$$;

-- Grant execute to authenticated and anon (needed for login flow)
GRANT EXECUTE ON FUNCTION public.check_user_auth_method(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_auth_method(text) TO anon;

COMMENT ON FUNCTION public.check_user_auth_method IS 
'Checks if a user exists and what authentication method they use. Safe to call from anon context during login flow.';

