-- Wallet atomic purchase application
CREATE OR REPLACE FUNCTION wallet_apply_purchase(
  p_invoice_id uuid,
  p_wallet_id uuid,
  p_credits int,
  p_usd_cents int,
  p_receipt_url text,
  p_idempotency_key text
) RETURNS TABLE (new_balance int) AS $$
DECLARE
  v_exists int;
BEGIN
  -- De-dupe on idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT 1 INTO v_exists FROM wallet_transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN QUERY SELECT (SELECT balance_credits FROM wallets WHERE id = p_wallet_id);
      RETURN;
    END IF;
  END IF;

  -- Lock wallet row
  PERFORM 1 FROM wallets WHERE id = p_wallet_id FOR UPDATE;

  -- Mark invoice paid if not already
  UPDATE invoices
    SET status = 'paid', receipt_url = COALESCE(p_receipt_url, receipt_url), updated_at = now()
  WHERE id = p_invoice_id AND status <> 'paid';

  -- Ledger entry
  INSERT INTO wallet_transactions (
    wallet_id, type, credits_delta, usd_cents, reference_type, reference_id, memo, idempotency_key
  ) VALUES (
    p_wallet_id, 'purchase', p_credits, p_usd_cents, 'invoice', p_invoice_id, 'Credit purchase via Stripe', p_idempotency_key
  );

  -- Update balance
  UPDATE wallets
     SET balance_credits = balance_credits + p_credits,
         updated_at = now()
   WHERE id = p_wallet_id;

  RETURN QUERY SELECT balance_credits FROM wallets WHERE id = p_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Wallet atomic refund application
CREATE OR REPLACE FUNCTION wallet_apply_refund(
  p_invoice_id uuid,
  p_wallet_id uuid,
  p_refund_usd_cents int,
  p_idempotency_key text
) RETURNS TABLE (new_balance int) AS $$
DECLARE
  v_exists int;
  v_credits int;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT 1 INTO v_exists FROM wallet_transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN QUERY SELECT (SELECT balance_credits FROM wallets WHERE id = p_wallet_id);
      RETURN;
    END IF;
  END IF;

  -- Convert refunded USD cents to credits (1 credit = $0.01)
  v_credits = p_refund_usd_cents;

  -- Lock wallet, write refund txn, update balance
  PERFORM 1 FROM wallets WHERE id = p_wallet_id FOR UPDATE;

  INSERT INTO wallet_transactions (
    wallet_id, type, credits_delta, usd_cents, reference_type, reference_id, memo, idempotency_key
  ) VALUES (
    p_wallet_id, 'refund', -v_credits, -p_refund_usd_cents, 'invoice', p_invoice_id, 'Stripe refund', p_idempotency_key
  );

  UPDATE wallets
     SET balance_credits = balance_credits - v_credits,
         updated_at = now()
   WHERE id = p_wallet_id;

  RETURN QUERY SELECT balance_credits FROM wallets WHERE id = p_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper to freeze if negative
CREATE OR REPLACE FUNCTION wallet_freeze_if_negative(p_wallet_id uuid) RETURNS void AS $$
DECLARE
  v_bal int;
BEGIN
  SELECT balance_credits INTO v_bal FROM wallets WHERE id = p_wallet_id;
  IF v_bal < 0 THEN
    UPDATE wallets SET status = 'frozen', updated_at = now() WHERE id = p_wallet_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add unique constraint on wallet_transactions idempotency_key
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_wallet_txn_idem'
  ) THEN
    ALTER TABLE wallet_transactions ADD CONSTRAINT uq_wallet_txn_idem UNIQUE (idempotency_key);
  END IF;
END $$;

-- Add index on invoices stripe_payment_intent_id for refund/dispute lookups
CREATE INDEX IF NOT EXISTS idx_invoices_pi ON invoices(stripe_payment_intent_id);