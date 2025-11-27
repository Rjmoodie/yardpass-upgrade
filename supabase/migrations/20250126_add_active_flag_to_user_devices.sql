-- Add active flag and improve user_devices table for token lifecycle management
-- This migration is idempotent and handles cases where:
-- 1. Table doesn't exist yet (will be created by 20250104_create_user_devices.sql)
-- 2. Table exists but active column is missing
-- 3. Table exists with active column already

DO $$
BEGIN
  -- Check if table exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_devices') THEN
    -- Add active column if it doesn't exist
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user_devices' 
      AND column_name = 'active'
    ) THEN
      ALTER TABLE public.user_devices ADD COLUMN active BOOLEAN DEFAULT true;
      UPDATE public.user_devices SET active = true WHERE active IS NULL;
      
      -- Create index if it doesn't exist
      CREATE INDEX IF NOT EXISTS idx_user_devices_active 
      ON public.user_devices(user_id, platform, active) 
      WHERE active = true;
      
      -- Add comment
      COMMENT ON COLUMN public.user_devices.active IS 'Whether this device token is currently active (false if invalidated by APNs)';
    END IF;
  END IF;
END $$;

