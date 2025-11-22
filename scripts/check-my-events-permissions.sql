-- Simple check: Which of your events can send role invites?

SELECT 
  e.id AS event_id,
  e.title,
  e.owner_context_type,
  o.name AS org_name,
  public.is_event_manager(e.id) AS can_send_invites,
  CASE 
    WHEN public.is_event_manager(e.id) = true THEN '✅ Can send invites'
    ELSE '❌ BLOCKED - This is your 403 event'
  END AS status
FROM public.events e
LEFT JOIN organizations.organizations o ON e.owner_context_id = o.id
WHERE e.created_by = auth.uid()
   OR e.owner_context_id IN (
     SELECT org_id FROM organizations.org_memberships 
     WHERE user_id = auth.uid()
   )
ORDER BY e.created_at DESC
LIMIT 20;

