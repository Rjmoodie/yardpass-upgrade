-- Migration: Add Stripe balance caching
-- Purpose: Reduce Stripe API calls and improve dashboard load performance
-- Date: November 10, 2025

-- Create balance cache table
CREATE TABLE IF NOT EXISTS public.stripe_balance_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type text NOT NULL CHECK (context_type IN ('individual', 'organization')),
  context_id uuid NOT NULL,
  stripe_account_id text NOT NULL,
  available_cents integer NOT NULL DEFAULT 0,
  pending_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  cached_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure only one cache entry per context
  CONSTRAINT unique_balance_cache_context UNIQUE (context_type, context_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_stripe_balance_cache_context
  ON public.stripe_balance_cache(context_type, context_id);

-- Index on expires_at for cache cleanup (no predicate, now() is VOLATILE)
CREATE INDEX IF NOT EXISTS idx_stripe_balance_cache_expires_at
  ON public.stripe_balance_cache(expires_at DESC);

-- RLS Policies
ALTER TABLE public.stripe_balance_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own cached balance
CREATE POLICY stripe_balance_cache_individual_select
  ON public.stripe_balance_cache
  FOR SELECT
  TO authenticated
  USING (
    context_type = 'individual'
    AND context_id = auth.uid()
  );

-- Policy: Org members can view their org's cached balance
CREATE POLICY stripe_balance_cache_org_select
  ON public.stripe_balance_cache
  FOR SELECT
  TO authenticated
  USING (
    context_type = 'organization'
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = stripe_balance_cache.context_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'editor')
    )
  );

-- Policy: Service role can write (for Edge Functions)
CREATE POLICY stripe_balance_cache_service_write
  ON public.stripe_balance_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Helper function to clean up expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_balance_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.stripe_balance_cache
  WHERE expires_at < now() - interval '1 hour';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.stripe_balance_cache TO authenticated;
GRANT ALL ON public.stripe_balance_cache TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_balance_cache TO service_role;

-- Add comment
COMMENT ON TABLE public.stripe_balance_cache IS 
  'Cached Stripe balance data to reduce API calls and improve dashboard performance. TTL: 5 minutes.';

-- Create a pg_cron job to clean up expired cache (optional, requires pg_cron extension)
-- Uncomment if you have pg_cron enabled:
-- SELECT cron.schedule(
--   'cleanup-stripe-balance-cache',
--   '0 * * * *', -- Every hour
--   $$SELECT public.cleanup_expired_balance_cache();$$
-- );

