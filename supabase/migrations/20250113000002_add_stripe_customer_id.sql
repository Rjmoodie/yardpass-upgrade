-- Add Stripe customer ID to user profiles for Customer Portal access
-- Generated: 2025-01-13

-- Add stripe_customer_id column to user_profiles
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id 
  ON public.user_profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON COLUMN public.user_profiles.stripe_customer_id IS 'Stripe Customer ID for accessing Customer Portal and managing payment methods';

-- Add unique constraint to prevent duplicate customer IDs
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_stripe_customer_unique'
  ) THEN
    ALTER TABLE public.user_profiles 
      ADD CONSTRAINT user_profiles_stripe_customer_unique UNIQUE (stripe_customer_id);
  END IF;
END $$;

