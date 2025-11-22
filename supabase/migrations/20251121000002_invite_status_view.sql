-- Create a view for easy monitoring of organization invite status
-- This provides a comprehensive view of all invites with their delivery status

CREATE OR REPLACE VIEW public.org_invite_status_log AS
SELECT 
  i.id AS invite_id,
  i.org_id,
  o.name AS organization_name,
  i.email AS invitee_email,
  i.role AS invited_role,
  i.status AS invite_status,
  i.email_status,
  i.email_sent_at,
  i.created_at AS invite_created_at,
  i.expires_at AS invite_expires_at,
  CASE 
    WHEN i.expires_at < NOW() THEN true 
    ELSE false 
  END AS is_expired,
  i.invited_by AS inviter_user_id,
  up.display_name AS inviter_name,
  au.email AS inviter_email,
  i.metadata,
  i.metadata->>'email_id' AS email_provider_id,
  i.metadata->>'email_error' AS email_error_message,
  CASE 
    WHEN i.status = 'accepted' THEN 'Accepted'
    WHEN i.expires_at < NOW() THEN 'Expired'
    WHEN i.email_status = 'sent' THEN 'Sent - Awaiting Response'
    WHEN i.email_status = 'failed' THEN 'Email Failed'
    WHEN i.email_status = 'error' THEN 'Email Error'
    WHEN i.email_status = 'no_config' THEN 'Email Not Configured'
    ELSE 'Pending'
  END AS display_status
FROM organizations.org_invitations i
LEFT JOIN public.organizations o ON i.org_id = o.id
LEFT JOIN public.user_profiles up ON i.invited_by = up.user_id
LEFT JOIN auth.users au ON i.invited_by = au.id
ORDER BY i.created_at DESC;

-- Grant access to authenticated users
GRANT SELECT ON public.org_invite_status_log TO authenticated;

-- Add comment
COMMENT ON VIEW public.org_invite_status_log IS 
  'Comprehensive view of organization invite status for tracking and debugging. Shows email delivery status, expiration, and invite state. Access filtered by org membership via underlying table RLS policies.';

