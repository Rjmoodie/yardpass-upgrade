-- ============================================================================
-- SECURITY FIX: Secure Role Invites System (Standalone Version)
-- ============================================================================
-- Purpose: Fix critical security gaps in role invite system
-- Risk Level: CRITICAL
-- 
-- Dependencies: NONE (works without is_platform_admin function)
-- 
-- Fixes:
-- 1. Remove anonymous access to role_invites (token exposure)
-- 2. Add proper RLS policies for invite visibility
-- 3. Add audit logging to accept_role_invite function
-- 4. Add scanner limit enforcement (max 50 per event)
-- 5. Add RLS policy for invite INSERT (defense in depth)
-- ============================================================================

-- ============================================================================
-- PART 1: Ensure audit_log table exists (may already exist)
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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_audit_log_user_recent 
  ON public.audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action_recent 
  ON public.audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_resource 
  ON public.audit_log(resource_type, resource_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see their own audit log
DROP POLICY IF EXISTS "Users can view own audit log" ON public.audit_log;
CREATE POLICY "Users can view own audit log"
  ON public.audit_log
  FOR SELECT
  USING (user_id = auth.uid());

GRANT SELECT ON public.audit_log TO authenticated;

-- ============================================================================
-- PART 2: Remove Anonymous Access to role_invites
-- ============================================================================

-- Revoke all grants to anon
DO $$
BEGIN
  -- Revoke from public schema view
  EXECUTE 'REVOKE ALL ON public.role_invites FROM anon';
  
  -- Revoke from events schema table
  EXECUTE 'REVOKE ALL ON events.role_invites FROM anon';
  
  RAISE NOTICE 'Revoked anonymous access to role_invites';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not revoke anon access (may not exist): %', SQLERRM;
END $$;

-- ============================================================================
-- PART 3: Add Proper RLS Policies for Invite Visibility
-- ============================================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "role_invites_select_event_managers" ON events.role_invites;
DROP POLICY IF EXISTS "role_invites_manage_event_managers" ON events.role_invites;

-- Policy: Who can SEE invites?
-- 1. Event managers can see invites for their events
-- 2. Users can see invites addressed to them (by email or phone)
CREATE POLICY "role_invites_select_authorized_only"
  ON events.role_invites
  FOR SELECT
  USING (
    -- Event managers
    public.is_event_manager(event_id)
    -- Users can see invites addressed to their email/phone
    OR (
      auth.uid() IS NOT NULL 
      AND (
        (email IS NOT NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        OR (phone IS NOT NULL AND phone = (SELECT phone FROM users.user_profiles WHERE user_id = auth.uid()))
      )
    )
  );

COMMENT ON POLICY "role_invites_select_authorized_only" ON events.role_invites IS
'Only event managers and invitees can view invites. Prevents token exposure.';

-- Policy: Who can INSERT invites?
CREATE POLICY "role_invites_insert_managers_only"
  ON events.role_invites
  FOR INSERT
  WITH CHECK (public.is_event_manager(event_id));

COMMENT ON POLICY "role_invites_insert_managers_only" ON events.role_invites IS
'Only event managers can create invites. Edge Function also validates (defense in depth).';

-- Policy: Who can UPDATE invites?
CREATE POLICY "role_invites_update_managers_only"
  ON events.role_invites
  FOR UPDATE
  USING (public.is_event_manager(event_id))
  WITH CHECK (public.is_event_manager(event_id));

COMMENT ON POLICY "role_invites_update_managers_only" ON events.role_invites IS
'Only event managers can update invites (revoke, transfer, etc.).';

-- Policy: Who can DELETE invites?
CREATE POLICY "role_invites_delete_managers_only"
  ON events.role_invites
  FOR DELETE
  USING (public.is_event_manager(event_id));

COMMENT ON POLICY "role_invites_delete_managers_only" ON events.role_invites IS
'Only event managers can delete invites.';

-- ============================================================================
-- PART 4: Update accept_role_invite Function with Audit Logging
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_role_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inv events.role_invites%ROWTYPE;
  v_event_id uuid;
  v_role public.role_type;
  v_now timestamptz := now();
  v_first_name text := '';
  v_user_email text;
  v_user_phone text;
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '28000';
  END IF;

  -- Get user email from auth.users
  SELECT au.email INTO v_user_email
  FROM auth.users au
  WHERE au.id = v_user_id;

  -- Get user phone from user_profiles
  SELECT up.phone INTO v_user_phone
  FROM public.user_profiles up
  WHERE up.user_id = v_user_id;

  -- Lock and fetch invite
  SELECT * INTO v_inv
  FROM events.role_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  -- Check if already accepted
  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object(
      'status', 'already_accepted',
      'event_id', v_inv.event_id,
      'role', v_inv.role,
      'accepted_user_id', v_inv.accepted_user_id
    );
  ELSIF v_inv.status IN ('revoked','expired') THEN
    RAISE EXCEPTION 'Invite is %', v_inv.status;
  END IF;

  -- Check expiration
  IF v_inv.expires_at < v_now THEN
    UPDATE events.role_invites
       SET status = 'expired'
     WHERE id = v_inv.id
       AND status = 'pending';
    RAISE EXCEPTION 'Invite expired';
  END IF;

  -- Validate email if invite has email
  IF v_inv.email IS NOT NULL THEN
    IF v_user_email IS NULL OR lower(v_user_email) != lower(v_inv.email) THEN
      RAISE EXCEPTION 'This invite is addressed to a different email.';
    END IF;
  END IF;

  -- Validate phone if invite has phone
  IF v_inv.phone IS NOT NULL THEN
    IF v_user_phone IS NULL OR 
       regexp_replace(v_user_phone, '[^0-9]', '', 'g') != regexp_replace(v_inv.phone, '[^0-9]', '', 'g') THEN
      RAISE EXCEPTION 'This invite is addressed to a different phone.';
    END IF;
  END IF;

  v_event_id := v_inv.event_id;
  v_role := v_inv.role;

  -- Get first name for response
  SELECT split_part(coalesce(up.display_name,''), ' ', 1)
    INTO v_first_name
  FROM public.user_profiles up
  WHERE up.user_id = v_user_id;

  -- Create event role assignment
  INSERT INTO events.event_roles (event_id, user_id, role, status, created_by, created_at, updated_at)
  VALUES (v_event_id, v_user_id, v_role, 'active', COALESCE(v_inv.invited_by, v_user_id), v_now, v_now)
  ON CONFLICT (event_id, user_id, role)
  DO UPDATE SET 
    status = 'active',
    updated_at = v_now;

  -- Mark invite as accepted
  UPDATE events.role_invites
     SET status = 'accepted',
         accepted_user_id = v_user_id,
         accepted_at = v_now
   WHERE id = v_inv.id;

  -- Revoke other pending invites
  UPDATE events.role_invites
     SET status = 'revoked'
   WHERE id <> v_inv.id
     AND event_id = v_event_id
     AND role = v_role
     AND status = 'pending'
     AND (
       (email IS NOT NULL AND lower(email) = lower(v_inv.email)) OR
       (phone IS NOT NULL AND phone = v_inv.phone)
     );

  -- 🔒 AUDIT LOG: Record invite acceptance
  BEGIN
    INSERT INTO public.audit_log (
      user_id,
      action,
      resource_type,
      resource_id,
      metadata
    )
    VALUES (
      v_user_id,
      'role_invite_accepted',
      'role_invite',
      v_inv.id,
      jsonb_build_object(
        'event_id', v_event_id,
        'role', v_role::text,
        'invite_email', v_inv.email,
        'invite_phone', v_inv.phone,
        'invited_by', v_inv.invited_by,
        'accepted_at', v_now
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Don't fail if audit log insert fails
      RAISE WARNING 'Failed to log to audit trail: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'status', 'accepted',
    'event_id', v_event_id,
    'role', v_role,
    'user_id', v_user_id,
    'first_name', v_first_name
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Role already exists, just mark invite as accepted
    UPDATE events.role_invites
       SET status = 'accepted',
           accepted_user_id = v_user_id,
           accepted_at = v_now
     WHERE id = v_inv.id;

    -- Still log to audit
    BEGIN
      INSERT INTO public.audit_log (
        user_id,
        action,
        resource_type,
        resource_id,
        metadata
      )
      VALUES (
        v_user_id,
        'role_invite_accepted',
        'role_invite',
        v_inv.id,
        jsonb_build_object(
          'event_id', v_inv.event_id,
          'role', v_inv.role::text,
          'already_had_role', true
        )
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to log to audit trail: %', SQLERRM;
    END;

    RETURN jsonb_build_object(
      'status', 'accepted',
      'event_id', v_inv.event_id,
      'role', v_inv.role,
      'user_id', v_user_id
    );
END;
$$;

-- ============================================================================
-- PART 5: Enforce Maximum Scanners Per Event
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_scanner_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  scanner_count INTEGER;
  max_scanners INTEGER := 50;
BEGIN
  IF NEW.role = 'scanner' AND NEW.status = 'active' THEN
    SELECT COUNT(*)
    INTO scanner_count
    FROM events.event_roles
    WHERE event_id = NEW.event_id
      AND role = 'scanner'
      AND status = 'active'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF scanner_count >= max_scanners THEN
      RAISE EXCEPTION 'Maximum % active scanners per event. Current: %. Contact support.', 
        max_scanners, scanner_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trg_enforce_scanner_limit ON events.event_roles;

CREATE TRIGGER trg_enforce_scanner_limit
  BEFORE INSERT OR UPDATE ON events.event_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_scanner_limit();

-- ============================================================================
-- PART 6: Update Event Role Policies (Without Platform Admin)
-- ============================================================================

DROP POLICY IF EXISTS "event_roles_select_self_or_manager" ON events.event_roles;
DROP POLICY IF EXISTS "event_roles_manage_event_manager" ON events.event_roles;
DROP POLICY IF EXISTS "event_roles_select_authorized" ON events.event_roles;
DROP POLICY IF EXISTS "event_roles_manage_authorized" ON events.event_roles;

-- Policy: Who can SEE event roles?
CREATE POLICY "event_roles_select_authorized"
  ON events.event_roles
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_event_manager(event_id)
  );

-- Policy: Who can MANAGE event roles?
CREATE POLICY "event_roles_manage_authorized"
  ON events.event_roles
  FOR ALL
  USING (public.is_event_manager(event_id))
  WITH CHECK (public.is_event_manager(event_id));

-- ============================================================================
-- PART 7: Update Public View Grants
-- ============================================================================

REVOKE ALL ON public.role_invites FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_invites TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check anon access removed:
DO $$
DECLARE
  anon_grants INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO anon_grants
  FROM information_schema.table_privileges 
  WHERE table_name = 'role_invites' 
    AND grantee = 'anon';
  
  IF anon_grants > 0 THEN
    RAISE WARNING 'Anonymous access still exists on role_invites!';
  ELSE
    RAISE NOTICE '✅ Anonymous access successfully removed from role_invites';
  END IF;
END $$;

-- Check policies created:
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE tablename = 'role_invites'
    AND policyname LIKE '%authorized%';
  
  IF policy_count >= 3 THEN
    RAISE NOTICE '✅ RLS policies created for role_invites';
  ELSE
    RAISE WARNING 'Expected at least 3 RLS policies, found %', policy_count;
  END IF;
END $$;

-- Check trigger exists:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_enforce_scanner_limit'
  ) THEN
    RAISE NOTICE '✅ Scanner limit trigger created';
  ELSE
    RAISE WARNING 'Scanner limit trigger not found';
  END IF;
END $$;

