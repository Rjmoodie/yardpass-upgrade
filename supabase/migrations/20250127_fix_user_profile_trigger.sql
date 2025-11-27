-- ============================================================================
-- FIX: handle_new_user trigger - Remove email column and fix schema access
-- ============================================================================
-- Issue: Trigger was trying to insert 'email' column which doesn't exist in users.user_profiles
-- This causes 500 errors during signup when the trigger fires
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, users
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
  
  -- Insert profile (server-controlled)
  -- NOTE: users.user_profiles does NOT have an email column
  -- Email is stored in auth.users.email
  INSERT INTO users.user_profiles (
    user_id,
    display_name,
    phone,
    role,
    verification_status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    display_name_value,
    phone_value,
    'attendee', -- ✅ ALWAYS start as attendee (server-enforced)
    'none',     -- ✅ ALWAYS start unverified (server-enforced)
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING; -- Prevent duplicates
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the auth operation
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 
'Auto-creates user profile on signup. Server-controlled to prevent privilege escalation. Fixed: removed email column reference.';

-- Ensure the function can bypass RLS (SECURITY DEFINER already handles this, but grant explicit permissions)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;

-- Verify RLS is enabled (should already be enabled, but ensure it's set)
ALTER TABLE users.user_profiles ENABLE ROW LEVEL SECURITY;

