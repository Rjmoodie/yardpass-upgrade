-- Add refund and spend functions for org wallets

-- Refund function (atomic with row lock)
CREATE OR REPLACE FUNCTION public.org_wallet_apply_refund(
  p_wallet_id UUID,
  p_refund_credits INTEGER,
  p_invoice_id UUID,
  p_stripe_event_id TEXT,
  p_description TEXT DEFAULT 'Refund'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id UUID;
BEGIN
  IF p_refund_credits <= 0 THEN RAISE EXCEPTION 'refund credits must be positive'; END IF;

  -- Idempotency
  IF p_stripe_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.org_wallet_transactions WHERE stripe_event_id = p_stripe_event_id
  ) THEN
    SELECT id INTO v_tx_id FROM public.org_wallet_transactions WHERE stripe_event_id = p_stripe_event_id;
    RETURN v_tx_id;
  END IF;

  -- Lock wallet row
  PERFORM 1 FROM public.org_wallets WHERE id = p_wallet_id FOR UPDATE;

  -- Create negative transaction
  INSERT INTO public.org_wallet_transactions (
    wallet_id, credits_delta, transaction_type, description, invoice_id, stripe_event_id
  ) VALUES (
    p_wallet_id, -p_refund_credits, 'refund', p_description, p_invoice_id, p_stripe_event_id
  ) RETURNING id INTO v_tx_id;

  -- Update balance
  UPDATE public.org_wallets
     SET balance_credits = balance_credits - p_refund_credits,
         updated_at = now()
   WHERE id = p_wallet_id;

  RETURN v_tx_id;
END;
$$;
REVOKE ALL ON FUNCTION public.org_wallet_apply_refund(UUID,INTEGER,UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_wallet_apply_refund(UUID,INTEGER,UUID,TEXT,TEXT) TO authenticated;

-- Spend function (atomic with row lock)
CREATE OR REPLACE FUNCTION public.org_wallet_apply_spend(
  p_wallet_id UUID,
  p_credits INTEGER,
  p_reference_type TEXT,
  p_reference_id UUID,
  p_description TEXT DEFAULT 'Campaign spend'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_id UUID;
  v_balance INT;
BEGIN
  IF p_credits <= 0 THEN RAISE EXCEPTION 'spend credits must be positive'; END IF;

  -- Lock wallet row and check balance
  SELECT balance_credits INTO v_balance 
  FROM public.org_wallets 
  WHERE id = p_wallet_id 
  FOR UPDATE;

  IF v_balance < p_credits THEN
    RAISE EXCEPTION 'insufficient funds';
  END IF;

  -- Create negative transaction
  INSERT INTO public.org_wallet_transactions (
    wallet_id, credits_delta, transaction_type, description, reference_type, reference_id
  ) VALUES (
    p_wallet_id, -p_credits, 'spend', p_description, p_reference_type, p_reference_id
  ) RETURNING id INTO v_tx_id;

  -- Update balance
  UPDATE public.org_wallets
     SET balance_credits = balance_credits - p_credits,
         updated_at = now()
   WHERE id = p_wallet_id;

  RETURN v_tx_id;
END;
$$;
REVOKE ALL ON FUNCTION public.org_wallet_apply_spend(UUID,INTEGER,TEXT,UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_wallet_apply_spend(UUID,INTEGER,TEXT,UUID,TEXT) TO authenticated;