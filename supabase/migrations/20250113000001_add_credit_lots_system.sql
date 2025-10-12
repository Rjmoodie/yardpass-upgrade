-- Add Credit Lot System for better credit tracking and refund granularity
-- Generated: 2025-01-13
-- Note: Credits purchased for orgs DO NOT expire

-- =========================================
-- 1) Create credit_lots table
-- =========================================
CREATE TABLE IF NOT EXISTS public.credit_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to either user wallet OR org wallet (but not both)
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE,
  org_wallet_id UUID REFERENCES public.org_wallets(id) ON DELETE CASCADE,
  
  -- Credit quantities
  quantity_purchased INTEGER NOT NULL CHECK (quantity_purchased > 0),
  quantity_remaining INTEGER NOT NULL CHECK (quantity_remaining >= 0 AND quantity_remaining <= quantity_purchased),
  
  -- Pricing info
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0), -- Price per credit at time of purchase
  
  -- Source tracking
  source TEXT NOT NULL CHECK (source IN ('purchase', 'grant', 'refund', 'promo', 'adjustment')),
  stripe_checkout_session_id TEXT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  
  -- Expiration (NULL = never expires, as is the case for org credits)
  expires_at TIMESTAMPTZ,
  
  -- Lifecycle timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  depleted_at TIMESTAMPTZ, -- When quantity_remaining becomes 0
  
  -- Metadata for auditing
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Ensure exactly one wallet type is set
  CONSTRAINT credit_lot_wallet_xor CHECK (
    (wallet_id IS NOT NULL)::int + (org_wallet_id IS NOT NULL)::int = 1
  )
);

-- Indexes for performance
CREATE INDEX idx_credit_lots_wallet ON public.credit_lots(wallet_id) 
  WHERE wallet_id IS NOT NULL AND quantity_remaining > 0;

CREATE INDEX idx_credit_lots_org_wallet ON public.credit_lots(org_wallet_id) 
  WHERE org_wallet_id IS NOT NULL AND quantity_remaining > 0;

CREATE INDEX idx_credit_lots_expires ON public.credit_lots(expires_at) 
  WHERE expires_at IS NOT NULL AND depleted_at IS NULL;

CREATE INDEX idx_credit_lots_checkout_session ON public.credit_lots(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

COMMENT ON TABLE public.credit_lots IS 'Tracks individual credit purchase lots for FIFO deduction and refund granularity';
COMMENT ON COLUMN public.credit_lots.expires_at IS 'NULL = never expires (standard for org credits)';

-- =========================================
-- 2) Add purchased_by_user_id to invoices
-- =========================================
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS purchased_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_purchased_by ON public.invoices(purchased_by_user_id);

COMMENT ON COLUMN public.invoices.purchased_by_user_id IS 'User who initiated the purchase (important for org credit purchases to track who paid)';

-- =========================================
-- 3) Add XOR constraint to invoices
-- =========================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_wallet_xor'
  ) THEN
    ALTER TABLE public.invoices 
      ADD CONSTRAINT invoices_wallet_xor CHECK (
        (wallet_id IS NOT NULL)::int + (org_wallet_id IS NOT NULL)::int = 1
      );
  END IF;
END $$;

-- =========================================
-- 4) FIFO Credit Deduction Function
-- =========================================
CREATE OR REPLACE FUNCTION public.deduct_credits_fifo(
  p_amount INTEGER,
  p_wallet_id UUID DEFAULT NULL,
  p_org_wallet_id UUID DEFAULT NULL
)
RETURNS TABLE (
  lot_id UUID,
  deducted INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot RECORD;
  v_remaining INTEGER := p_amount;
  v_to_deduct INTEGER;
BEGIN
  -- Validate inputs
  IF (p_wallet_id IS NULL AND p_org_wallet_id IS NULL) THEN
    RAISE EXCEPTION 'Must provide either wallet_id or org_wallet_id';
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Deduction amount must be positive';
  END IF;
  
  -- Loop through lots FIFO (oldest first, expiring first)
  FOR v_lot IN
    SELECT id, quantity_remaining
    FROM public.credit_lots
    WHERE (
      (p_wallet_id IS NOT NULL AND wallet_id = p_wallet_id) OR
      (p_org_wallet_id IS NOT NULL AND org_wallet_id = p_org_wallet_id)
    )
    AND quantity_remaining > 0
    AND (expires_at IS NULL OR expires_at > now())
    ORDER BY 
      -- Expiring credits first (if any)
      CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END,
      expires_at ASC NULLS LAST,
      -- Then oldest credits first
      created_at ASC
    FOR UPDATE SKIP LOCKED -- Prevent deadlocks in concurrent spending
  LOOP
    EXIT WHEN v_remaining <= 0;
    
    -- Deduct from this lot
    v_to_deduct := LEAST(v_lot.quantity_remaining, v_remaining);
    
    UPDATE public.credit_lots
    SET 
      quantity_remaining = quantity_remaining - v_to_deduct,
      depleted_at = CASE 
        WHEN quantity_remaining - v_to_deduct = 0 THEN now() 
        ELSE depleted_at 
      END
    WHERE id = v_lot.id;
    
    v_remaining := v_remaining - v_to_deduct;
    
    -- Return this deduction
    lot_id := v_lot.id;
    deducted := v_to_deduct;
    RETURN NEXT;
  END LOOP;
  
  -- Check if we had enough credits
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient credits: needed %, only had %', p_amount, p_amount - v_remaining;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.deduct_credits_fifo IS 'FIFO credit deduction - deducts from oldest/expiring lots first';

-- =========================================
-- 5) Function to check available credits
-- =========================================
CREATE OR REPLACE FUNCTION public.get_available_credits(
  p_wallet_id UUID DEFAULT NULL,
  p_org_wallet_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(quantity_remaining), 0)
  INTO v_total
  FROM public.credit_lots
  WHERE (
    (p_wallet_id IS NOT NULL AND wallet_id = p_wallet_id) OR
    (p_org_wallet_id IS NOT NULL AND org_wallet_id = p_org_wallet_id)
  )
  AND quantity_remaining > 0
  AND (expires_at IS NULL OR expires_at > now());
  
  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.get_available_credits IS 'Returns total available credits (excluding expired lots)';

-- =========================================
-- 6) Function to get lot breakdown
-- =========================================
CREATE OR REPLACE FUNCTION public.get_credit_lot_breakdown(
  p_wallet_id UUID DEFAULT NULL,
  p_org_wallet_id UUID DEFAULT NULL
)
RETURNS TABLE (
  lot_id UUID,
  remaining INTEGER,
  purchased INTEGER,
  unit_price_cents INTEGER,
  source TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.id,
    cl.quantity_remaining,
    cl.quantity_purchased,
    cl.unit_price_cents,
    cl.source,
    cl.expires_at,
    cl.created_at
  FROM public.credit_lots cl
  WHERE (
    (p_wallet_id IS NOT NULL AND cl.wallet_id = p_wallet_id) OR
    (p_org_wallet_id IS NOT NULL AND cl.org_wallet_id = p_org_wallet_id)
  )
  AND cl.quantity_remaining > 0
  ORDER BY 
    CASE WHEN cl.expires_at IS NULL THEN 1 ELSE 0 END,
    cl.expires_at ASC NULLS LAST,
    cl.created_at ASC;
END;
$$;

COMMENT ON FUNCTION public.get_credit_lot_breakdown IS 'Returns detailed breakdown of available credit lots for UI display';

-- =========================================
-- 7) RLS Policies for credit_lots
-- =========================================
ALTER TABLE public.credit_lots ENABLE ROW LEVEL SECURITY;

-- Users can see their own lots
CREATE POLICY credit_lots_select_own 
  ON public.credit_lots FOR SELECT
  USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

-- Org members can see org lots
CREATE POLICY credit_lots_select_org 
  ON public.credit_lots FOR SELECT
  USING (
    org_wallet_id IN (
      SELECT ow.id 
      FROM public.org_wallets ow
      JOIN public.org_memberships om ON om.org_id = ow.org_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Only system can insert/update
CREATE POLICY credit_lots_system_only 
  ON public.credit_lots FOR ALL
  USING (false) WITH CHECK (false);

-- =========================================
-- 8) Grant permissions
-- =========================================
GRANT EXECUTE ON FUNCTION public.deduct_credits_fifo(INTEGER, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_credits(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_lot_breakdown(UUID, UUID) TO authenticated;

-- =========================================
-- 9) Update invoice RLS to show purchased_by
-- =========================================
-- Drop and recreate invoice select policy to include purchased_by_user_id
DO $$ 
BEGIN
  DROP POLICY IF EXISTS invoices_select_own ON public.invoices;
  DROP POLICY IF EXISTS invoices_select_org ON public.invoices;
END $$;

-- Users can see invoices for their wallet OR that they purchased
CREATE POLICY invoices_select_own 
  ON public.invoices FOR SELECT
  USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
    OR purchased_by_user_id = auth.uid()
  );

-- Org members can see org invoices
CREATE POLICY invoices_select_org 
  ON public.invoices FOR SELECT
  USING (
    org_wallet_id IN (
      SELECT ow.id 
      FROM public.org_wallets ow
      JOIN public.org_memberships om ON om.org_id = ow.org_id
      WHERE om.user_id = auth.uid()
    )
  );

