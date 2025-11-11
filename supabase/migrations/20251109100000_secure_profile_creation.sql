-- ============================================================================
-- SECURITY FIX: Move Profile Creation to Database Trigger
-- ============================================================================
-- Purpose: Remove client authority over profile creation
-- Risk Level: CRITICAL
-- Fixes: Privilege escalation via client-side role manipulation
--
-- Changes:
-- 1. Create trigger to auto-create profiles on auth.users insert
-- 2. Lock down user_profiles RLS to prevent role self-promotion
-- 3. Add audit logging for role changes
-- ============================================================================

-- ============================================================================
-- PART 1: Auto-create profiles on signup (server-side only)
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
  -- Extract display name from metadata (with fallback)
  display_name_value := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    SPLIT_PART(NEW.email, '@', 1), -- use email prefix if no name
    'User'
  );
  
  -- Extract phone if provided
  phone_value := COALESCE(
    NEW.phone,
    NEW.raw_user_meta_data->>'phone'
  );
  
  -- Insert profile (server-side controlled)
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
    'attendee', -- ✅ ALWAYS start as attendee (server-enforced)
    'none',     -- ✅ ALWAYS start unverified (server-enforced)
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING; -- Prevent duplicates
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 
'Auto-creates user profile on signup. Server-controlled to prevent privilege escalation.';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
'Automatically creates user profile when new user signs up. Prevents client-side role manipulation.';

-- ============================================================================
-- PART 2: Lock down role and verification_status fields
-- ============================================================================

-- Drop existing RLS policies on user_profiles if they exist
DROP POLICY IF EXISTS "Users can update own profile" ON users.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON users.user_profiles;

-- Policy: Users can SELECT their own profile
CREATE POLICY "Users can view own profile"
  ON users.user_profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can UPDATE their own profile BUT NOT role or verification_status
CREATE POLICY "Users can update own profile (restricted)"
  ON users.user_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- ✅ CRITICAL: Prevent role/verification changes via client
    AND role = (SELECT role FROM users.user_profiles WHERE user_id = auth.uid())
    AND verification_status = (SELECT verification_status FROM users.user_profiles WHERE user_id = auth.uid())
  );

COMMENT ON POLICY "Users can update own profile (restricted)" ON users.user_profiles IS
'Users can update their profile but CANNOT change role or verification_status (server-only).';

-- Policy: Prevent direct INSERT (trigger handles this)
CREATE POLICY "Prevent direct profile creation"
  ON users.user_profiles
  FOR INSERT
  WITH CHECK (false); -- ✅ Block all client-side inserts

COMMENT ON POLICY "Prevent direct profile creation" ON users.user_profiles IS
'Profiles are created by database trigger only. Client cannot directly insert.';

-- ============================================================================
-- PART 3: Server-controlled role update function
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
  v_is_admin BOOLEAN;
  v_result JSONB;
BEGIN
  v_caller_id := auth.uid();
  
  -- Check if caller is platform admin
  v_is_admin := public.is_platform_admin();
  
  -- Validation: Only admins can change roles
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only platform admins can change user roles';
  END IF;
  
  -- Validation: Check valid role
  IF p_new_role NOT IN ('attendee', 'organizer') THEN
    RAISE EXCEPTION 'Invalid role: must be attendee or organizer';
  END IF;
  
  -- Get old role for audit log
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
  
  -- Log to audit trail
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
  
  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'old_role', v_old_role,
    'new_role', p_new_role
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.update_user_role IS
'Server-controlled role update. Only platform admins can call. Logs to audit trail.';

-- ============================================================================
-- PART 4: Audit log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS
'System-wide audit log for security-sensitive actions (role changes, admin actions, etc.)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_user_recent 
  ON public.audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action_recent 
  ON public.audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_resource 
  ON public.audit_log(resource_type, resource_id, created_at DESC);

-- RLS: Users can only see their own audit log entries
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit log"
  ON public.audit_log
  FOR SELECT
  USING (user_id = auth.uid() OR public.is_platform_admin());

COMMENT ON POLICY "Users can view own audit log" ON public.audit_log IS
'Users can see their own actions, admins can see all.';

-- ============================================================================
-- PART 5: Platform admin helper function
-- ============================================================================

-- Note: For now, this returns false. Implement platform_admins table separately.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- TODO: Implement platform_admins table
  -- For now, return false (no platform admins yet)
  SELECT false;
  
  -- Future implementation:
  -- SELECT EXISTS (
  --   SELECT 1 FROM public.platform_admins
  --   WHERE user_id = auth.uid()
  -- );
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
'Checks if current user is a platform admin. Currently returns false (not yet implemented).';

-- ============================================================================
-- PART 6: Grant permissions
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon;

-- Grant permissions on audit_log
GRANT SELECT ON public.audit_log TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (run these to test)
-- ============================================================================

-- 1. Check trigger exists
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name = 'on_auth_user_created';

-- 2. Check RLS policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'users' AND tablename = 'user_profiles';

-- 3. Test profile auto-creation (as admin in SQL editor):
-- INSERT INTO auth.users (id, email, raw_user_meta_data)
-- VALUES (gen_random_uuid(), 'test@example.com', '{"display_name": "Test User"}'::jsonb);
-- SELECT * FROM users.user_profiles WHERE email = 'test@example.com';

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- DROP FUNCTION IF EXISTS public.update_user_role(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.is_platform_admin();
-- DROP TABLE IF EXISTS public.audit_log CASCADE;

