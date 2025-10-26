-- Check which organization owns the wallet with 40,000 credits
SELECT 
  w.id as wallet_id,
  w.org_id,
  w.balance_credits,
  o.name as org_name,
  o.handle as org_handle
FROM organizations.org_wallets w
JOIN organizations.organizations o ON o.id = w.org_id
WHERE w.balance_credits > 0
ORDER BY w.balance_credits DESC;

-- Also check recent purchases
SELECT 
  i.id,
  i.org_wallet_id,
  i.credits_purchased,
  i.status,
  i.created_at,
  o.name as org_name
FROM organizations.invoices i
JOIN organizations.org_wallets w ON w.id = i.org_wallet_id
JOIN organizations.organizations o ON o.id = w.org_id
ORDER BY i.created_at DESC
LIMIT 5;

