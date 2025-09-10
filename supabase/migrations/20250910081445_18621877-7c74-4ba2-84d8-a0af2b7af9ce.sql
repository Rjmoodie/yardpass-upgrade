-- Schema improvements for production-ready role invites
-- Make sure we can uniquely find invites by token
CREATE UNIQUE INDEX IF NOT EXISTS role_invites_token_uidx ON public.role_invites(token);

-- Track acceptance time
ALTER TABLE public.role_invites
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- De-dupe roles: one user can hold a role once per event
-- Use DO block for conditional constraint creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_roles_unique'
  ) THEN
    ALTER TABLE public.event_roles
    ADD CONSTRAINT event_roles_unique UNIQUE (event_id, user_id, role);
  END IF;
END $$;

-- Drop existing function to change return type
DROP FUNCTION IF EXISTS public.accept_role_invite(text);

-- Production-ready accept_role_invite RPC function
CREATE OR REPLACE FUNCTION public.accept_role_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_inv        role_invites%rowtype;
  v_event_id   uuid;
  v_role       text;
  v_now        timestamptz := now();
  v_first_name text := '';
  v_result     jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '28000';
  END IF;

  -- Lock the invite row to avoid race conditions when clicking twice
  SELECT *
    INTO v_inv
  FROM role_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  -- Already processed?
  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object(
      'status','already_accepted',
      'event_id', v_inv.event_id,
      'role', v_inv.role,
      'accepted_user_id', v_inv.accepted_user_id
    );
  ELSIF v_inv.status IN ('revoked','expired') THEN
    RAISE EXCEPTION 'Invite is %', v_inv.status;
  END IF;

  -- Expired? (also mark it)
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < v_now THEN
    UPDATE role_invites
       SET status = 'expired'
     WHERE id = v_inv.id
       AND status = 'pending';
    RAISE EXCEPTION 'Invite expired';
  END IF;

  -- Optional recipient binding:
  -- if the invite specifies an email/phone, the current user must match
  IF v_inv.email IS NOT NULL THEN
    PERFORM 1
      FROM user_profiles up
     WHERE up.user_id = v_user_id
       AND lower(coalesce(up.email,'')) = lower(v_inv.email);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This invite is addressed to a different email.';
    END IF;
  END IF;

  IF v_inv.phone IS NOT NULL THEN
    -- naive normalization: strip +, -, spaces
    PERFORM 1
      FROM user_profiles up
     WHERE up.user_id = v_user_id
       AND regexp_replace(coalesce(up.phone,''), '[^0-9]', '', 'g')
           = regexp_replace(v_inv.phone, '[^0-9]', '', 'g');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This invite is addressed to a different phone.';
    END IF;
  END IF;

  v_event_id := v_inv.event_id;
  v_role     := v_inv.role;

  -- Optional: grab first name for downstream auditing (not required)
  SELECT split_part(coalesce(up.display_name,''), ' ', 1)
    INTO v_first_name
    FROM user_profiles up
   WHERE up.user_id = v_user_id;

  -- Upsert the role: set to active if it exists
  INSERT INTO event_roles (event_id, user_id, role, status, created_by, created_at)
  VALUES (v_event_id, v_user_id, v_role, 'active', coalesce(v_inv.invited_by, v_user_id), v_now)
  ON CONFLICT (event_id, user_id, role)
  DO UPDATE SET status = 'active';

  -- Mark this invite accepted
  UPDATE role_invites
     SET status = 'accepted',
         accepted_user_id = v_user_id,
         accepted_at = v_now
   WHERE id = v_inv.id;

  -- Revoke other duplicate pending invites to same event+role+recipient (nice-to-have cleanup)
  UPDATE role_invites
     SET status = 'revoked'
   WHERE id <> v_inv.id
     AND event_id = v_event_id
     AND role = v_role
     AND status = 'pending'
     AND (
          (email IS NOT NULL AND email = v_inv.email)
       OR (phone IS NOT NULL AND phone = v_inv.phone)
     );

  v_result := jsonb_build_object(
    'status', 'accepted',
    'event_id', v_event_id,
    'role', v_role,
    'user_id', v_user_id,
    'first_name', v_first_name
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    -- Role already existed concurrently; still mark invite accepted and return success
    UPDATE role_invites
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

-- Lock it down & expose to logged-in users
REVOKE ALL ON FUNCTION public.accept_role_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.accept_role_invite(text) TO authenticated;