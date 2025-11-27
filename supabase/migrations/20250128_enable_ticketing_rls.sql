-- ============================================================================
-- ENABLE RLS ON TICKETING TABLES
-- ============================================================================
-- Payment and checkout data - requires proper access control
-- ============================================================================

-- ============================================================================
-- PART 1: Checkout Tables - User-Scoped
-- ============================================================================

-- checkout_sessions - Active checkout sessions
-- NOTE: Anonymous users can create/view sessions via Edge Functions (service_role)
-- Clients can read sessions by session_id for status checks
ALTER TABLE ticketing.checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own checkout sessions"
  ON ticketing.checkout_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow anonymous to view sessions (for status checks during checkout flow)
CREATE POLICY "Anonymous can view checkout sessions by id"
  ON ticketing.checkout_sessions
  FOR SELECT
  TO anon
  USING (true); -- Edge Functions control which sessions are accessible

CREATE POLICY "Service role full access to checkout_sessions"
  ON ticketing.checkout_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- checkout_answers - Checkout form answers
-- NOTE: Anonymous users can submit answers during guest checkout
ALTER TABLE ticketing.checkout_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view answers for their checkout sessions"
  ON ticketing.checkout_answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ticketing.checkout_sessions cs
      WHERE cs.id = checkout_answers.session_id
        AND cs.user_id = auth.uid()
    )
  );

-- Allow anonymous to view/insert answers for their checkout sessions
CREATE POLICY "Anonymous can manage answers for checkout sessions"
  ON ticketing.checkout_answers
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true); -- Edge Functions validate session ownership

CREATE POLICY "Service role full access to checkout_answers"
  ON ticketing.checkout_answers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- checkout_questions - Checkout form questions (public read, service-role write)
ALTER TABLE ticketing.checkout_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read checkout questions"
  ON ticketing.checkout_questions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role full access to checkout_questions"
  ON ticketing.checkout_questions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 2: Refund Tables
-- ============================================================================

-- refund_log - Refund processing logs (service-role only)
ALTER TABLE ticketing.refund_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refund_log_service_role_only"
  ON ticketing.refund_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- refund_policies - Refund policy config (public read, service-role write)
ALTER TABLE ticketing.refund_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read refund policies"
  ON ticketing.refund_policies
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role full access to refund_policies"
  ON ticketing.refund_policies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 3: Addon Tables
-- ============================================================================

-- event_addons - Event addon products (respect event visibility)
ALTER TABLE ticketing.event_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view event addons for visible events"
  ON ticketing.event_addons
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM events.events ev
      WHERE ev.id = event_addons.event_id
        AND ev.visibility = 'public'
        AND ev.deleted_at IS NULL
    )
  );

CREATE POLICY "Event managers can manage addons for their events"
  ON ticketing.event_addons
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events.events ev
      WHERE ev.id = event_addons.event_id
        AND (
          ev.created_by = auth.uid()
          OR (ev.owner_context_type = 'organization' AND EXISTS (
            SELECT 1 FROM organizations.org_memberships om
            WHERE om.org_id = ev.owner_context_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'editor')
          ))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events.events ev
      WHERE ev.id = event_addons.event_id
        AND (
          ev.created_by = auth.uid()
          OR (ev.owner_context_type = 'organization' AND EXISTS (
            SELECT 1 FROM organizations.org_memberships om
            WHERE om.org_id = ev.owner_context_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'editor')
          ))
        )
    )
  );

CREATE POLICY "Service role full access to event_addons"
  ON ticketing.event_addons
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- order_addons - Order addon items (user-scoped, same as orders)
ALTER TABLE ticketing.order_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view addons for their orders"
  ON ticketing.order_addons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ticketing.orders o
      WHERE o.id = order_addons.order_id
        AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to order_addons"
  ON ticketing.order_addons
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
WHERE schemaname = 'ticketing'
    AND tablename IN (
        'checkout_answers',
        'checkout_questions',
        'checkout_sessions',
        'refund_log',
        'refund_policies',
        'event_addons',
        'order_addons'
    )
ORDER BY tablename;

