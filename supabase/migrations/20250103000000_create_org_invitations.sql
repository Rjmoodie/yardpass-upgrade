-- Create organization invitations table
CREATE TABLE IF NOT EXISTS org_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  accepted_user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS org_invitations_org_id_idx ON org_invitations(org_id);
CREATE INDEX IF NOT EXISTS org_invitations_email_idx ON org_invitations(email);
CREATE INDEX IF NOT EXISTS org_invitations_token_idx ON org_invitations(token);
CREATE INDEX IF NOT EXISTS org_invitations_status_idx ON org_invitations(status);

-- Enable RLS
ALTER TABLE org_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for org_invitations
-- Organization members can view invitations for their organization
CREATE POLICY "org_members_can_view_invitations" ON org_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_memberships m
      WHERE m.org_id = org_invitations.org_id
        AND m.user_id = auth.uid()
    )
  );

-- Organization admins and owners can create invitations
CREATE POLICY "org_admins_can_create_invitations" ON org_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_memberships m
      WHERE m.org_id = org_invitations.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- Organization admins and owners can update invitations (revoke, etc.)
CREATE POLICY "org_admins_can_update_invitations" ON org_invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM org_memberships m
      WHERE m.org_id = org_invitations.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

-- Anyone can read invitations by token (for accepting invites)
CREATE POLICY "anyone_can_read_by_token" ON org_invitations
  FOR SELECT USING (true);

-- Function to accept organization invitation
CREATE OR REPLACE FUNCTION accept_org_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_inv        org_invitations%rowtype;
  v_org_id     uuid;
  v_role       text;
  v_now        timestamptz := now();
  v_result     jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '28000';
  END IF;

  -- Lock the invite row to avoid race conditions
  SELECT *
    INTO v_inv
  FROM org_invitations
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  -- Already processed?
  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object(
      'status', 'already_accepted',
      'org_id', v_inv.org_id,
      'role', v_inv.role,
      'accepted_user_id', v_inv.accepted_user_id
    );
  ELSIF v_inv.status IN ('revoked', 'expired') THEN
    RAISE EXCEPTION 'Invitation is %', v_inv.status;
  END IF;

  -- Expired?
  IF v_inv.expires_at < v_now THEN
    UPDATE org_invitations
       SET status = 'expired'
     WHERE id = v_inv.id
       AND status = 'pending';
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM org_memberships m
    WHERE m.org_id = v_inv.org_id
      AND m.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this organization';
  END IF;

  -- Accept the invitation
  UPDATE org_invitations
     SET status = 'accepted',
         accepted_user_id = v_user_id,
         accepted_at = v_now
   WHERE id = v_inv.id;

  -- Add user to organization
  INSERT INTO org_memberships (org_id, user_id, role)
  VALUES (v_inv.org_id, v_user_id, v_inv.role);

  RETURN jsonb_build_object(
    'status', 'accepted',
    'org_id', v_inv.org_id,
    'role', v_inv.role,
    'accepted_user_id', v_user_id
  );
END;
$$;
