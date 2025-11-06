-- Fix gen_qr_code to use pgcrypto extension properly
-- The function was failing because gen_random_bytes wasn't in the search path

-- Ensure pgcrypto is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Recreate gen_qr_code with explicit extension reference
CREATE OR REPLACE FUNCTION public.gen_qr_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text;
  tries int := 0;
  i int; 
  idx int;
  random_byte bytea;
BEGIN
  LOOP
    out := '';
    FOR i IN 1..8 LOOP
      -- Use gen_random_bytes from pgcrypto extension (available in extensions schema)
      random_byte := gen_random_bytes(1);
      idx := (get_byte(random_byte, 0) % length(alphabet)) + 1;
      out := out || substr(alphabet, idx, 1);
    END LOOP;

    -- Ensure uniqueness (check ticketing schema where tickets actually live)
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM ticketing.tickets WHERE qr_code = out
    );

    tries := tries + 1;
    IF tries > 8 THEN
      RAISE EXCEPTION 'Failed to generate unique qr_code after % tries', tries 
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;
  RETURN out;
END;
$$;

COMMENT ON FUNCTION public.gen_qr_code IS 'Generate unique 8-character QR code using pgcrypto';

GRANT EXECUTE ON FUNCTION public.gen_qr_code TO service_role, authenticated;

