-- Fix RLS permissions for search_all function
ALTER FUNCTION public.search_all(uuid, text, text, timestamptz, timestamptz, boolean, integer, integer) SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.search_all TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_all TO anon;