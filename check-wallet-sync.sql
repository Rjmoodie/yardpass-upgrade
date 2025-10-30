-- Check wallet balance and if it syncs with campaign spend
SELECT 
  w.id AS wallet_id,
  w.org_id,
  w.balance_credits AS current_wallet_balance,
  w.updated_at AS wallet_last_updated,
  o.name AS org_name
FROM public.org_wallets w
JOIN public.organizations o ON o.id = w.org_id
WHERE w.id = 'db7dca8a-fc56-452d-8a57-53880b93131b';

-- Check total spent across all campaigns for this org
SELECT 
  c.org_id,
  COUNT(*) AS total_campaigns,
  SUM(c.spent_credits) AS total_spent_all_campaigns,
  SUM(c.total_budget_credits) AS total_budget_all_campaigns
FROM campaigns.campaigns c
WHERE c.org_id = (SELECT org_id FROM campaigns.campaigns WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec')
GROUP BY c.org_id;

-- Check ledger entries (this is the transaction log)
SELECT 
  campaign_id,
  metric_type,
  quantity,
  credits_charged,
  occurred_at
FROM campaigns.ad_spend_ledger
WHERE org_wallet_id = 'db7dca8a-fc56-452d-8a57-53880b93131b'
ORDER BY occurred_at DESC
LIMIT 10;

