-- Add invite tracking columns to org_invitations table
-- This enables detailed tracking of email delivery status and debugging

-- Add email tracking columns if they don't exist
-- Note: org_invitations is in the organizations schema
ALTER TABLE IF EXISTS organizations.org_invitations 
  ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending' 
    CHECK (email_status IN ('pending', 'sent', 'failed', 'error', 'no_config'));

ALTER TABLE IF EXISTS organizations.org_invitations 
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS organizations.org_invitations 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for querying by email status
CREATE INDEX IF NOT EXISTS idx_org_invitations_email_status 
  ON organizations.org_invitations(email_status);

-- Add index for querying pending invites
CREATE INDEX IF NOT EXISTS idx_org_invitations_status_expires 
  ON organizations.org_invitations(status, expires_at) 
  WHERE status = 'pending';

-- Add comments for documentation
COMMENT ON COLUMN organizations.org_invitations.email_status IS 
  'Status of email delivery: pending (not sent yet), sent (successfully sent), failed (delivery failed), error (exception occurred), no_config (no email service configured)';

COMMENT ON COLUMN organizations.org_invitations.email_sent_at IS 
  'Timestamp when the invitation email was successfully sent';

COMMENT ON COLUMN organizations.org_invitations.metadata IS 
  'JSON metadata for tracking: email_id (from provider), email_error (if failed), inviter_email, expires_in_hours, etc.';

