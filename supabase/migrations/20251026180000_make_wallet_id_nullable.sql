-- Make wallet_id nullable since we use org_wallet_id for organization campaigns
-- wallet_id can be used for individual user campaigns if needed in the future

ALTER TABLE campaigns.ad_spend_ledger
ALTER COLUMN wallet_id DROP NOT NULL;

COMMENT ON COLUMN campaigns.ad_spend_ledger.wallet_id IS 'Individual user wallet (nullable). For org campaigns, use org_wallet_id instead.';

