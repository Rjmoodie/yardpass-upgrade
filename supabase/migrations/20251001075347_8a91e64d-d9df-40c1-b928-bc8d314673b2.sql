-- Make wallet_id nullable on invoices table to support org-only invoices
-- For org purchases, org_wallet_id is set and wallet_id remains NULL
-- For user purchases, wallet_id is set and org_wallet_id remains NULL
ALTER TABLE public.invoices ALTER COLUMN wallet_id DROP NOT NULL;

-- Add a constraint to ensure at least one wallet is specified
ALTER TABLE public.invoices ADD CONSTRAINT invoices_wallet_check 
  CHECK (wallet_id IS NOT NULL OR org_wallet_id IS NOT NULL);