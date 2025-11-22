-- Get the definition of is_event_org_editor function

SELECT 
  pg_get_functiondef('public.is_event_org_editor'::regproc) AS function_definition;

