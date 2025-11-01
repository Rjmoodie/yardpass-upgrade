-- ============================================================================
-- Event Roles System: Per-Event Role Assignment & Invitations
-- ============================================================================
-- Creates tables for:
-- 1. events.event_roles: Track role assignments per event (scanner, staff, etc.)
-- 2. events.role_invites: Handle pending invitations with token-based acceptance
-- 
-- Stack Integration:
-- - Works with existing events.events schema
-- - Works with existing ticketing.tickets schema
-- - Works with existing organizations.org_memberships schema
-- - Exposes via public views for PostgREST API access
-- ============================================================================

-- Add enums for event roles and invite status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
    CREATE TYPE public.role_type AS ENUM (
      'organizer',
      'scanner',
      'staff',
      'volunteer',
      'vendor',
      'guest'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_status') THEN
    CREATE TYPE public.invite_status AS ENUM (
      'pending',
      'accepted',
      'expired',
      'revoked'
    );
  END IF;
END
$$;

-- ============================================================================
-- Helper Functions for Role & Permission Checks
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_org_role(p_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role::text
  FROM organizations.org_memberships m
  WHERE m.org_id = p_org_id
    AND m.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_role(p_org_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_current_user_org_role(p_org_id) = ANY(p_roles);
$$;

CREATE OR REPLACE FUNCTION public.is_event_individual_owner(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM events.events e
    WHERE e.id = p_event_id
      AND e.owner_context_type = 'individual'
      AND e.owner_context_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_org_editor(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM events.events e
    WHERE e.id = p_event_id
      AND e.owner_context_type = 'organization'
      AND public.is_org_role(e.owner_context_id, ARRAY['editor','admin','owner'])
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_manager(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.is_event_individual_owner(p_event_id)
      OR public.is_event_org_editor(p_event_id);
$$;

-- ============================================================================
-- Event Roles Table: Tracks per-event role assignments
-- ============================================================================

-- Drop and recreate to ensure clean state
DROP TABLE IF EXISTS events.event_roles CASCADE;

-- Create in events schema (matches your schema structure)
CREATE TABLE events.event_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.role_type NOT NULL,
  status text NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_roles_unique UNIQUE (event_id, user_id, role)
);

COMMENT ON TABLE events.event_roles IS 'Per-event role assignments (scanner, staff, etc.)';
COMMENT ON COLUMN events.event_roles.status IS 'Role status: active or inactive';
COMMENT ON COLUMN events.event_roles.updated_at IS 'Timestamp of last update (for tracking role changes)';

CREATE INDEX IF NOT EXISTS event_roles_event_id_idx
  ON events.event_roles (event_id);

CREATE INDEX IF NOT EXISTS event_roles_user_id_idx
  ON events.event_roles (user_id);

CREATE INDEX IF NOT EXISTS event_roles_event_role_status_idx
  ON events.event_roles (event_id, role, status);

ALTER TABLE events.event_roles ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see their own roles OR event managers can see all roles
CREATE POLICY event_roles_select_self_or_manager
ON events.event_roles
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_event_manager(event_id)
);

-- RLS: Only event managers can manage roles
CREATE POLICY event_roles_manage_event_manager
ON events.event_roles
FOR ALL
USING (public.is_event_manager(event_id))
WITH CHECK (public.is_event_manager(event_id));

-- Create public view for API access (matches your pattern)
DROP VIEW IF EXISTS public.event_roles CASCADE;

CREATE VIEW public.event_roles AS
SELECT 
  id,
  event_id,
  user_id,
  role,
  status,
  created_by,
  created_at,
  updated_at
FROM events.event_roles;

COMMENT ON VIEW public.event_roles IS 'Public view of event roles for API access';

GRANT ALL ON TABLE events.event_roles TO anon;
GRANT ALL ON TABLE events.event_roles TO authenticated;
GRANT ALL ON TABLE events.event_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_roles TO authenticated;
GRANT SELECT ON public.event_roles TO anon;

-- ============================================================================
-- Role Invites Table: Handles pending invitations
-- ============================================================================

-- Drop and recreate to ensure clean state
DROP TABLE IF EXISTS events.role_invites CASCADE;

-- Create in events schema (matches your structure)
CREATE TABLE events.role_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events.events(id) ON DELETE CASCADE,
  role public.role_type NOT NULL,
  email text,
  phone text,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.invite_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT role_invites_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

COMMENT ON TABLE events.role_invites IS 'Pending event role invitations with token-based acceptance';
COMMENT ON COLUMN events.role_invites.token IS 'Unique secure token for invitation acceptance';
COMMENT ON COLUMN events.role_invites.status IS 'Invite status: pending, accepted, expired, or revoked';

CREATE UNIQUE INDEX IF NOT EXISTS role_invites_event_email_idx
  ON events.role_invites (event_id, lower(email))
  WHERE email IS NOT NULL AND status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS role_invites_event_phone_idx
  ON events.role_invites (event_id, phone)
  WHERE phone IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS role_invites_token_idx
  ON events.role_invites (token);

CREATE INDEX IF NOT EXISTS role_invites_status_expires_idx
  ON events.role_invites (status, expires_at);

ALTER TABLE events.role_invites ENABLE ROW LEVEL SECURITY;

-- RLS: Event managers can view invites for their events
CREATE POLICY role_invites_select_event_managers
ON events.role_invites
FOR SELECT
USING (public.is_event_manager(event_id));

-- RLS: Event managers can manage invites
CREATE POLICY role_invites_manage_event_managers
ON events.role_invites
FOR ALL
USING (public.is_event_manager(event_id))
WITH CHECK (public.is_event_manager(event_id));

-- Create public view for API access
DROP VIEW IF EXISTS public.role_invites CASCADE;

CREATE VIEW public.role_invites AS
SELECT 
  id,
  event_id,
  role,
  email,
  phone,
  token,
  expires_at,
  invited_by,
  accepted_user_id,
  status,
  created_at,
  accepted_at
FROM events.role_invites;

COMMENT ON VIEW public.role_invites IS 'Public view of role invites for API access';

GRANT ALL ON TABLE events.role_invites TO anon;
GRANT ALL ON TABLE events.role_invites TO authenticated;
GRANT ALL ON TABLE events.role_invites TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_invites TO authenticated;
GRANT SELECT ON public.role_invites TO anon;

-- ============================================================================
-- Invite Acceptance Function: Powers token-based role acceptance
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

  -- Get user email from auth.users (email is stored there, not in user_profiles)
  SELECT au.email INTO v_user_email
  FROM auth.users au
  WHERE au.id = v_user_id;

  -- Get user phone from user_profiles view
  SELECT up.phone INTO v_user_phone
  FROM public.user_profiles up
  WHERE up.user_id = v_user_id;

  -- Lock and fetch invite from events schema
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

  -- Validate email if invite has email (check against auth.users.email)
  IF v_inv.email IS NOT NULL THEN
    IF v_user_email IS NULL OR lower(v_user_email) != lower(v_inv.email) THEN
      RAISE EXCEPTION 'This invite is addressed to a different email.';
    END IF;
  END IF;

  -- Validate phone if invite has phone (check against user_profiles.phone)
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

  -- Create event role assignment in events schema
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

  -- Revoke other pending invites for same email/phone to same event/role
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

    RETURN jsonb_build_object(
      'status', 'accepted',
      'event_id', v_inv.event_id,
      'role', v_inv.role,
      'user_id', v_user_id
    );
END;
$$;

COMMENT ON FUNCTION public.accept_role_invite IS 'Accepts a role invitation using a secure token';

-- ============================================================================
-- Grant Permissions on Functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_current_user_org_role(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_role(uuid, text[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_event_individual_owner(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_event_org_editor(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_event_manager(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_role_invite(text) TO anon, authenticated, service_role;

-- ============================================================================
-- Update Events Access Policy (if exists)
-- ============================================================================
-- This adds event_roles to event access checks

DO $$
BEGIN
  -- Drop old policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'events'
      AND tablename = 'events'
      AND policyname = 'events_read_access'
  ) THEN
    DROP POLICY "events_read_access" ON events.events;
  END IF;
END
$$;

-- Create comprehensive read policy that includes event roles
-- Note: Adjust based on your actual tickets schema (ticketing.tickets or public.tickets)
CREATE POLICY events_read_access ON events.events
FOR SELECT USING (
  -- Public events
  visibility = 'public'
  -- Individual owner
  OR (auth.uid() IS NOT NULL AND owner_context_type = 'individual' AND owner_context_id = auth.uid())
  -- Organization editor+ (restricted from viewers for privacy)
  OR (
    auth.uid() IS NOT NULL 
    AND owner_context_type = 'organization'
    AND public.is_org_role(owner_context_id, ARRAY['editor','admin','owner'])
  )
  -- Has event-specific role (NEW! - This enables scanners/staff access)
  OR (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM events.event_roles er
      WHERE er.event_id = events.events.id
        AND er.user_id = auth.uid()
        AND er.status = 'active'
    )
  )
  -- Has ticket (check ticketing schema first, fallback to public)
  OR (
    auth.uid() IS NOT NULL 
    AND (
      EXISTS (
        SELECT 1 FROM ticketing.tickets t
        WHERE t.event_id = events.events.id
          AND t.owner_user_id = auth.uid()
          AND t.status IN ('issued','transferred','redeemed')
      )
      -- Fallback if tickets are in public schema instead
      OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.event_id = events.events.id
          AND t.owner_user_id = auth.uid()
          AND t.status IN ('issued','transferred','redeemed')
      )
    )
  )
  -- Has invite
  OR (
    auth.uid() IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM events.event_invites ei
      WHERE ei.event_id = events.events.id
        AND ei.user_id = auth.uid()
    )
  )
);

COMMENT ON POLICY events_read_access ON events.events IS 'Users can view public events, events they own/manage (org editors+), events they have roles for (scanners/staff), or events they have tickets/invites to. Org viewers cannot access org events unless they have tickets or specific roles.';

