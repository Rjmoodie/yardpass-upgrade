-- ============================================================================
-- ENABLE RLS ON PUBLIC SCHEMA TABLES
-- ============================================================================
-- System logs and user preferences
-- ============================================================================

-- ============================================================================
-- PART 1: System Log Tables - Service Role Only
-- ============================================================================

-- notification_emails - Email notification logs (service-role only)
ALTER TABLE public.notification_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_emails_service_role_only"
  ON public.notification_emails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- stripe_webhook_events - Stripe webhook processing (service-role only)
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stripe_webhook_events_service_role_only"
  ON public.stripe_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 2: User Preferences - User-Scoped
-- ============================================================================

-- user_email_preferences - User email preferences
ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email preferences"
  ON public.user_email_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own email preferences"
  ON public.user_email_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own email preferences"
  ON public.user_email_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own email preferences"
  ON public.user_email_preferences
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access to user_email_preferences"
  ON public.user_email_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'notification_emails',
        'stripe_webhook_events',
        'user_email_preferences'
    )
ORDER BY tablename;


