-- Match your events to their organizations and check membership

SELECT 
  e.id AS event_id,
  e.title AS event_title,
  e.owner_context_id AS org_id,
  o.name AS org_name,
  CASE 
    WHEN m.user_id IS NOT NULL THEN '✅ You are a member (role: ' || m.role || ')'
    ELSE '❌ NOT A MEMBER - This is your 403 problem!'
  END AS membership_status,
  public.is_event_manager(e.id) AS can_send_invites
FROM events.events e
LEFT JOIN organizations.organizations o ON e.owner_context_id = o.id
LEFT JOIN organizations.org_memberships m ON m.org_id = e.owner_context_id AND m.user_id = auth.uid()
WHERE e.created_by = auth.uid()
  AND e.owner_context_type = 'organization'
ORDER BY e.created_at DESC;

