-- Fix search path for the new function
ALTER FUNCTION public.update_post_comment_count() SET search_path = public;