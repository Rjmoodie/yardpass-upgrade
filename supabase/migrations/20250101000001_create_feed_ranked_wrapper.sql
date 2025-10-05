-- Create wrapper function for edge function compatibility
-- This maintains the expected function name while using our improved algorithm

CREATE OR REPLACE FUNCTION public.get_home_feed_ranked(
  p_user_id uuid,
  p_limit   int DEFAULT 80,
  p_offset  int DEFAULT 0
)
RETURNS TABLE (
  item_type text,
  item_id uuid,
  event_id uuid,
  score numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT * FROM public.get_home_feed_ids(p_user_id, p_limit, p_offset);
$$;
