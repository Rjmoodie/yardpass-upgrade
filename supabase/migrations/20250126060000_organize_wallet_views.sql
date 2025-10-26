-- ============================================================
-- Move org_wallet_transactions view to organizations schema
-- ============================================================
-- For consistency, move the public view to organizations schema

-- Drop the public view
DROP VIEW IF EXISTS public.org_wallet_transactions;

-- The table is already in organizations.org_wallet_transactions
-- Just need to ensure the public view points correctly

-- Create view in organizations schema (if needed)
-- Actually, the table already exists in organizations schema
-- We just need a public view for PostgREST API access

CREATE OR REPLACE VIEW public.org_wallet_transactions AS
SELECT 
  id,
  wallet_id,
  transaction_type,
  credits_delta,
  description,
  reference_type,
  reference_id,
  invoice_id,
  stripe_event_id,
  metadata,
  created_at
FROM organizations.org_wallet_transactions;

COMMENT ON VIEW public.org_wallet_transactions IS 'Public view of organizations.org_wallet_transactions for API access';

-- Grant access
GRANT SELECT ON public.org_wallet_transactions TO authenticated;
GRANT SELECT ON public.org_wallet_transactions TO anon;

-- Enable RLS (inherits from base table)
-- The RLS policies on organizations.org_wallet_transactions will apply

-- ============================================================
-- Update org_wallets view for consistency
-- ============================================================

-- Ensure org_wallets also has a public view
DROP VIEW IF EXISTS public.org_wallets;

CREATE OR REPLACE VIEW public.org_wallets AS
SELECT 
  id,
  org_id,
  balance_credits,
  low_balance_threshold,
  auto_reload_enabled,
  auto_reload_topup_credits,
  status,
  created_at,
  updated_at
FROM organizations.org_wallets;

COMMENT ON VIEW public.org_wallets IS 'Public view of organizations.org_wallets for API access';

-- Grant access
GRANT SELECT, UPDATE ON public.org_wallets TO authenticated;

-- Enable RLS (inherits from base table)
-- The RLS policies on organizations.org_wallets will apply

