-- ========================================
-- AUTOMATIC WALLET SYNC SYSTEM
-- ========================================
-- Automatically deduct credits from org wallet when campaigns spend

-- ========================================
-- 1. Create trigger function
-- ========================================
CREATE OR REPLACE FUNCTION campaigns.deduct_from_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_org_id UUID;
BEGIN
  -- Get current wallet balance and org_id
  SELECT balance_credits, org_id 
  INTO v_current_balance, v_org_id
  FROM public.org_wallets
  WHERE id = NEW.org_wallet_id;
  
  -- Check if wallet exists
  IF NOT FOUND THEN
    RAISE WARNING 'Wallet % not found for ledger entry %', NEW.org_wallet_id, NEW.id;
    RETURN NEW;
  END IF;
  
  -- Check if wallet has sufficient balance
  IF v_current_balance < NEW.credits_charged THEN
    RAISE WARNING 'Insufficient balance in wallet % (has %, needs %). Ledger entry created but wallet not deducted.',
      NEW.org_wallet_id, v_current_balance, NEW.credits_charged;
    -- Still allow the ledger entry (campaign can go into debt)
    RETURN NEW;
  END IF;
  
  -- Deduct from wallet
  UPDATE public.org_wallets
  SET 
    balance_credits = balance_credits - NEW.credits_charged,
    updated_at = NOW()
  WHERE id = NEW.org_wallet_id;
  
  RAISE NOTICE 'Deducted % credits from wallet % (new balance: %)',
    NEW.credits_charged, NEW.org_wallet_id, v_current_balance - NEW.credits_charged;
  
  RETURN NEW;
END;
$$;

-- ========================================
-- 2. Create trigger on ad_spend_ledger
-- ========================================
DROP TRIGGER IF EXISTS on_ledger_deduct_wallet ON campaigns.ad_spend_ledger;

CREATE TRIGGER on_ledger_deduct_wallet
  AFTER INSERT ON campaigns.ad_spend_ledger
  FOR EACH ROW
  EXECUTE FUNCTION campaigns.deduct_from_wallet();

-- ========================================
-- 3. Create reverse function (for deletions/refunds)
-- ========================================
CREATE OR REPLACE FUNCTION campaigns.refund_to_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add credits back to wallet
  UPDATE public.org_wallets
  SET 
    balance_credits = balance_credits + OLD.credits_charged,
    updated_at = NOW()
  WHERE id = OLD.org_wallet_id;
  
  RAISE NOTICE 'Refunded % credits to wallet %',
    OLD.credits_charged, OLD.org_wallet_id;
  
  RETURN OLD;
END;
$$;

-- ========================================
-- 4. Create trigger for refunds (optional)
-- ========================================
DROP TRIGGER IF EXISTS on_ledger_refund_wallet ON campaigns.ad_spend_ledger;

CREATE TRIGGER on_ledger_refund_wallet
  AFTER DELETE ON campaigns.ad_spend_ledger
  FOR EACH ROW
  EXECUTE FUNCTION campaigns.refund_to_wallet();

-- ========================================
-- 5. Sync existing ledger entries (one-time fix)
-- ========================================
-- This will deduct the 2 credits that were already spent

DO $$
DECLARE
  v_wallet_id UUID := 'db7dca8a-fc56-452d-8a57-53880b93131b';
  v_total_to_deduct NUMERIC;
  v_current_balance NUMERIC;
BEGIN
  -- Calculate total that needs to be deducted
  SELECT COALESCE(SUM(credits_charged), 0)
  INTO v_total_to_deduct
  FROM campaigns.ad_spend_ledger
  WHERE org_wallet_id = v_wallet_id;
  
  -- Get current balance
  SELECT balance_credits INTO v_current_balance
  FROM public.org_wallets
  WHERE id = v_wallet_id;
  
  -- Apply the deduction
  IF v_total_to_deduct > 0 THEN
    UPDATE public.org_wallets
    SET 
      balance_credits = balance_credits - v_total_to_deduct,
      updated_at = NOW()
    WHERE id = v_wallet_id;
    
    RAISE NOTICE '✅ Synced wallet: Deducted % credits (from % to %)',
      v_total_to_deduct, v_current_balance, v_current_balance - v_total_to_deduct;
  ELSE
    RAISE NOTICE '✅ No sync needed - no previous charges';
  END IF;
END $$;

-- ========================================
-- 6. Create view for wallet audit
-- ========================================
CREATE OR REPLACE VIEW public.wallet_audit AS
SELECT 
  w.id AS wallet_id,
  w.org_id,
  o.name AS org_name,
  w.balance_credits AS current_balance,
  COALESCE(SUM(ledger.credits_charged), 0) AS total_spent_from_ledger,
  w.balance_credits + COALESCE(SUM(ledger.credits_charged), 0) AS calculated_original_balance,
  w.updated_at AS last_updated
FROM public.org_wallets w
JOIN public.organizations o ON o.id = w.org_id
LEFT JOIN campaigns.ad_spend_ledger ledger ON ledger.org_wallet_id = w.id
GROUP BY w.id, w.org_id, o.name, w.balance_credits, w.updated_at;

GRANT SELECT ON public.wallet_audit TO authenticated;

-- ========================================
-- 7. Verify the setup
-- ========================================
-- Check trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'ad_spend_ledger'
  AND trigger_name = 'on_ledger_deduct_wallet';

-- Check wallet balance after sync
SELECT 
  id,
  balance_credits,
  updated_at
FROM public.org_wallets
WHERE id = 'db7dca8a-fc56-452d-8a57-53880b93131b';

-- Check wallet audit
SELECT * FROM public.wallet_audit
WHERE wallet_id = 'db7dca8a-fc56-452d-8a57-53880b93131b';

