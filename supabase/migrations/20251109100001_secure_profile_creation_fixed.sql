-- ============================================================================
-- SECURITY FIX: Secure Profile Creation (Fixed Version)
-- ============================================================================
-- Purpose: Remove client authority over profile creation
-- Risk Level: CRITICAL
-- ============================================================================

-- ============================================================================
-- PART 1: Drop ALL existing insecure policies on user_profiles
-- ============================================================================

DO $$
BEGIN
  -- Drop all existing policies to ensure clean slate
  DROP POLICY IF EXISTS "own_profile_all" ON users.user_profiles;
  DROP POLICY IF EXISTS "Allow profile creation during signup" ON users.user_profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON users.user_profiles;
  DROP POLICY IF EXISTS "Users can update their own profile" ON users.user_profiles;
  DROP POLICY IF EXISTS "Users can update their own sponsor mode" ON users.user_profiles;
  DROP POLICY IF EXISTS "user_profiles_update_self" ON users.user_profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON users.user_profiles;
  DROP POLICY IF EXISTS "Users can view own profile" ON users.user_profiles;
  
  RAISE NOTICE 'Dropped existing policies on user_profiles';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Some policies may not have existed: %', SQLERRM;
END $$;

-- ============================================================================
-- PART 2: Create secure handle_new_user function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name_value TEXT;
  phone_value TEXT;
BEGIN
  -- Extract display name from metadata
  display_name_value := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    SPLIT_PART(NEW.email, '@', 1),
    'User'
  );
  
  -- Extract phone
  phone_value := COALESCE(
    NEW.phone,
    NEW.raw_user_meta_data->>'phone'
  );
  
  -- Insert profile (server-controlled)
  INSERT INTO users.user_profiles (
    user_id,
    display_name,
    email,
    phone,
    role,
    verification_status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    display_name_value,
    NEW.email,
    phone_value,
    'attendee',
    'none',
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 
'Auto-creates user profile. Server-controlled to prevent privilege escalation.';

-- ============================================================================
-- PART 3: Update trigger
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- PART 4: Create NEW secure RLS policies
-- ============================================================================

-- Policy 1: SELECT - Keep existing public visibility
CREATE POLICY "user_profiles_select_all"
  ON users.user_profiles
  FOR SELECT
  USING (true);

COMMENT ON POLICY "user_profiles_select_all" ON users.user_profiles IS
'All users can view all profiles (public social platform).';

-- Policy 2: INSERT - Block ALL client inserts
CREATE POLICY "user_profiles_insert_blocked"
  ON users.user_profiles
  FOR INSERT
  WITH CHECK (false);

COMMENT ON POLICY "user_profiles_insert_blocked" ON users.user_profiles IS
'SECURITY: Profiles created by trigger only. Client cannot insert.';

-- Policy 3: UPDATE - Allow updates BUT block role/verification changes
CREATE POLICY "user_profiles_update_restricted"
  ON users.user_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND role = (SELECT role FROM users.user_profiles WHERE user_id = auth.uid())
    AND verification_status = (SELECT verification_status FROM users.user_profiles WHERE user_id = auth.uid())
  );

COMMENT ON POLICY "user_profiles_update_restricted" ON users.user_profiles IS
'SECURITY: Users can update profile but CANNOT change role or verification_status.';

-- Policy 4: DELETE - Prevent profile deletion
CREATE POLICY "user_profiles_delete_blocked"
  ON users.user_profiles
  FOR DELETE
  USING (false);

COMMENT ON POLICY "user_profiles_delete_blocked" ON users.user_profiles IS
'SECURITY: Profiles cannot be deleted (use soft delete if needed).';

-- ============================================================================
-- PART 5: Server-controlled role update function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id UUID,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_role TEXT;
  v_caller_id UUID;
  v_result JSONB;
BEGIN
  v_caller_id := auth.uid();
  
  -- For now, only allow self-updates (until platform admin exists)
  -- In production, add: IF NOT public.is_platform_admin() THEN...
  IF v_caller_id != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Only platform admins can change other users roles';
  END IF;
  
  -- Validate role
  IF p_new_role NOT IN ('attendee', 'organizer') THEN
    RAISE EXCEPTION 'Invalid role: must be attendee or organizer';
  END IF;
  
  -- Get old role
  SELECT role INTO v_old_role
  FROM users.user_profiles
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Update role
  UPDATE users.user_profiles
  SET 
    role = p_new_role,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log if audit_log exists
  BEGIN
    INSERT INTO public.audit_log (
      user_id,
      action,
      resource_type,
      resource_id,
      metadata
    )
    VALUES (
      v_caller_id,
      'user_role_updated',
      'user_profile',
      p_user_id,
      jsonb_build_object(
        'old_role', v_old_role,
        'new_role', p_new_role,
        'target_user_id', p_user_id
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Audit log insert failed: %', SQLERRM;
  END;
  
  v_result := jsonb_build_object(
    'success', true,
    'old_role', v_old_role,
    'new_role', p_new_role
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.update_user_role IS
'Server-controlled role update. Validates permissions and logs changes.';

GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT) TO authenticated;

-- ============================================================================
-- PART 6: Create is_platform_admin stub
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT false;
  -- TODO: Implement platform_admins table
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
'Platform admin check. Currently returns false (not yet implemented).';

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete';
  RAISE NOTICE 'Run scripts/check-profile-trigger.sql to verify';
END $$;

