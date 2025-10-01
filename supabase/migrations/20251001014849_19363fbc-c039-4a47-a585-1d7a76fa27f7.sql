-- Add unique constraint on wallets.user_id to prevent race conditions
ALTER TABLE wallets ADD CONSTRAINT wallets_user_unique UNIQUE (user_id);

-- Add index for wallet transactions queries
CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet_created 
ON wallet_transactions(wallet_id, created_at DESC);

-- Replace ensure_wallet_exists with more secure version
DROP FUNCTION IF EXISTS ensure_wallet_exists(uuid);

CREATE OR REPLACE FUNCTION ensure_wallet_exists_for_auth_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE 
  uid uuid := auth.uid();
  wid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Atomic upsert with ON CONFLICT
  INSERT INTO wallets (user_id)
  VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  -- Fetch wallet id
  SELECT id INTO wid FROM wallets WHERE user_id = uid;
  RETURN wid;
END;
$$;

-- Restrict access to authenticated users only
REVOKE ALL ON FUNCTION ensure_wallet_exists_for_auth_user() FROM public;
GRANT EXECUTE ON FUNCTION ensure_wallet_exists_for_auth_user() TO authenticated;