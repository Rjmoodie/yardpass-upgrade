-- Check organization wallet balance
SELECT 
  w.id,
  w.org_id,
  w.balance_credits,
  w.updated_at,
  o.name AS org_name
FROM public.org_wallets w
JOIN public.organizations o ON o.id = w.org_id
WHERE w.id = 'db7dca8a-fc56-452d-8a57-53880b93131b';

-- Check if wallet transactions exist for this campaign
SELECT 
  wt.id,
  wt.amount_credits,
  wt.transaction_type,
  wt.description,
  wt.created_at
FROM public.wallet_transactions wt
WHERE wt.wallet_id = 'db7dca8a-fc56-452d-8a57-53880b93131b'
ORDER BY created_at DESC
LIMIT 10;

-- Check campaign spent vs wallet deductions
SELECT 
  c.id,
  c.name,
  c.spent_credits AS campaign_spent,
  COALESCE(SUM(ledger.credits_charged), 0) AS ledger_total,
  w.balance_credits AS wallet_balance
FROM campaigns.campaigns c
JOIN public.org_wallets w ON w.org_id = c.org_id
LEFT JOIN campaigns.ad_spend_ledger ledger ON ledger.campaign_id = c.id
WHERE c.id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
GROUP BY c.id, c.name, c.spent_credits, w.balance_credits;

