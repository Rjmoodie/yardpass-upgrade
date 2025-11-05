-- Create user_devices table for push notification tokens

CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  push_token TEXT NOT NULL,
  device_name TEXT,
  device_model TEXT,
  os_version TEXT,
  app_version TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, push_token)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_push_token ON public.user_devices(push_token);
CREATE INDEX IF NOT EXISTS idx_user_devices_platform ON public.user_devices(platform);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see/manage their own devices
CREATE POLICY "user_devices_select_own"
  ON public.user_devices FOR SELECT
  TO public
  USING (user_id = auth.uid());

CREATE POLICY "user_devices_insert_own"
  ON public.user_devices FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_devices_update_own"
  ON public.user_devices FOR UPDATE
  TO public
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_devices_delete_own"
  ON public.user_devices FOR DELETE
  TO public
  USING (user_id = auth.uid());

-- Service role can see all devices (for sending push notifications)
CREATE POLICY "user_devices_service_role_all"
  ON public.user_devices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_user_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_devices_updated_at
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_devices_updated_at();

-- Comment
COMMENT ON TABLE public.user_devices IS 'Stores device tokens for push notifications (iOS/Android)';
COMMENT ON COLUMN public.user_devices.push_token IS 'APNs or FCM device token';
COMMENT ON COLUMN public.user_devices.platform IS 'Device platform: ios, android, or web';





