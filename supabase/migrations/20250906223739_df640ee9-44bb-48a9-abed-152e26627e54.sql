-- Enable RLS on new tables
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for idempotency_keys
CREATE POLICY "Users can only access own idempotency keys"
ON public.idempotency_keys
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS policies for rate_limits  
CREATE POLICY "Users can only access own rate limits"
ON public.rate_limits
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Service role can manage both tables
CREATE POLICY "Service role can manage idempotency keys"
ON public.idempotency_keys
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage rate limits"
ON public.rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix function search paths
CREATE OR REPLACE FUNCTION public.refresh_trending_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.trending_posts;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.idempotency_keys 
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  DELETE FROM public.rate_limits 
  WHERE minute < NOW() - INTERVAL '1 hour';
END;
$$;