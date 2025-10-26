-- ============================================================
-- Expose org_wallets to PostgREST properly
-- ============================================================

-- Option 1: Grant usage on organizations schema
GRANT USAGE ON SCHEMA organizations TO anon, authenticated;

-- Grant SELECT on the base table
GRANT SELECT ON organizations.org_wallets TO anon, authenticated;
GRANT SELECT ON organizations.org_wallet_transactions TO anon, authenticated;

-- Ensure RLS is enabled (already done but double-check)
ALTER TABLE organizations.org_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations.org_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

