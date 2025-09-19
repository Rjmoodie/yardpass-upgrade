-- Create a placeholder function to prevent the error
CREATE OR REPLACE FUNCTION public.refresh_search_docs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- This function does nothing - search_docs_mv no longer exists
  -- Created as placeholder to prevent "function does not exist" errors
  RETURN;
END;
$function$;