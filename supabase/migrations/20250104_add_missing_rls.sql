-- Add RLS to tables that are missing it (security linter warnings)

-- 1. user_tag_preferences - users should only see their own preferences
ALTER TABLE public.user_tag_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_tag_preferences_select_own"
ON public.user_tag_preferences
AS PERMISSIVE
FOR SELECT
TO public
USING (user_id = auth.uid());

CREATE POLICY "user_tag_preferences_insert_own"
ON public.user_tag_preferences
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_tag_preferences_update_own"
ON public.user_tag_preferences
AS PERMISSIVE
FOR UPDATE
TO public
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_tag_preferences_delete_own"
ON public.user_tag_preferences
AS PERMISSIVE
FOR DELETE
TO public
USING (user_id = auth.uid());

-- 2. platform_settings - admin only access
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings_select_all"
ON public.platform_settings
AS PERMISSIVE
FOR SELECT
TO public
USING (true);  -- Anyone can read settings

CREATE POLICY "platform_settings_manage_service_role"
ON public.platform_settings
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Note: Only service_role can insert/update/delete platform settings
-- Regular users can only read them

COMMENT ON POLICY "user_tag_preferences_select_own" ON public.user_tag_preferences IS
'Users can only see their own tag preferences';

COMMENT ON POLICY "platform_settings_select_all" ON public.platform_settings IS
'All users can read platform settings, only service_role can modify';





