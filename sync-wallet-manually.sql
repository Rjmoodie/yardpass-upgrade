-- Manual wallet sync: Deduct campaign spending from wallet

-- First, let's see what needs to be deducted
SELECT 
  w.id AS wallet_id,
  w.balance_credits AS current_balance,
  SUM(ledger.credits_charged) AS total_spent_from_ledger,
  w.balance_credits - SUM(ledger.credits_charged) AS expected_new_balance
FROM public.org_wallets w
JOIN campaigns.ad_spend_ledger ledger ON ledger.org_wallet_id = w.id
WHERE w.id = 'db7dca8a-fc56-452d-8a57-53880b93131b'
GROUP BY w.id, w.balance_credits;

-- If you want to apply the sync (UNCOMMENT to run):
/*
UPDATE public.org_wallets
SET balance_credits = balance_credits - (
  SELECT SUM(credits_charged)
  FROM campaigns.ad_spend_ledger
  WHERE org_wallet_id = 'db7dca8a-fc56-452d-8a57-53880b93131b'
    AND occurred_at > (SELECT COALESCE(MAX(synced_at), '2000-01-01') FROM wallet_sync_log)
)
WHERE id = 'db7dca8a-fc56-452d-8a57-53880b93131b';
*/

-- Verify the update (run after uncommenting above)
/*
SELECT 
  id,
  balance_credits,
  updated_at
FROM public.org_wallets
WHERE id = 'db7dca8a-fc56-452d-8a57-53880b93131b';
*/

