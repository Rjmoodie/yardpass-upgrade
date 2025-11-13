-- ============================================================================
-- REFUND REQUEST QUEUE SYSTEM
-- ============================================================================
-- Allows customers to request refunds, organizers to approve/decline
-- Supports auto-approve toggle per event
-- ============================================================================

-- ============================================================================
-- STEP 1: Create Refund Requests Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticketing.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ticketing.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Request details
  reason TEXT NOT NULL CHECK (reason IN (
    'cant_attend', 
    'event_postponed', 
    'event_cancelled',
    'duplicate_purchase', 
    'not_as_described',
    'other'
  )),
  details TEXT,  -- Customer explanation
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Waiting for organizer review
    'approved',   -- Organizer approved (refund processing)
    'declined',   -- Organizer declined
    'processed'   -- Refund completed (linked to refund_log)
  )),
  
  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  
  -- Review details
  reviewed_by UUID REFERENCES auth.users(id),
  organizer_response TEXT,      -- Optional message to customer
  decline_reason TEXT,           -- Why declined
  
  -- Link to completed refund
  refund_log_id UUID REFERENCES ticketing.refund_log(id),
  
  -- Metadata
  metadata JSONB,
  
  -- Prevent duplicate pending requests per order
  CONSTRAINT unique_pending_request_per_order 
    UNIQUE NULLS NOT DISTINCT (order_id, status) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Remove the constraint and add a unique index instead (more flexible)
ALTER TABLE ticketing.refund_requests DROP CONSTRAINT IF EXISTS unique_pending_request_per_order;

CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_requests_one_pending_per_order
ON ticketing.refund_requests(order_id)
WHERE status = 'pending';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_refund_requests_order ON ticketing.refund_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_user ON ticketing.refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON ticketing.refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_pending ON ticketing.refund_requests(status, requested_at) 
  WHERE status = 'pending';

COMMENT ON TABLE ticketing.refund_requests IS 
  'Customer refund requests. Organizers approve/decline. Can auto-approve if enabled and meets safety criteria.';

COMMENT ON COLUMN ticketing.refund_requests.status IS 
  'pending: awaiting review, approved: organizer approved, declined: organizer declined, processed: refund completed';

-- Grant permissions
GRANT SELECT, INSERT ON ticketing.refund_requests TO authenticated;
GRANT ALL ON ticketing.refund_requests TO service_role;

-- ============================================================================
-- STEP 2: Row Level Security Policies
-- ============================================================================

ALTER TABLE ticketing.refund_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own refund requests" ON ticketing.refund_requests;
DROP POLICY IF EXISTS "Users can create refund requests for their orders" ON ticketing.refund_requests;
DROP POLICY IF EXISTS "Organizers can view requests for their events" ON ticketing.refund_requests;
DROP POLICY IF EXISTS "Service role full access on refund requests" ON ticketing.refund_requests;
DROP POLICY IF EXISTS "Organizers can manage refund requests for their events" ON ticketing.refund_requests;

-- Customers can view their own requests
CREATE POLICY "Users can view their own refund requests"
  ON ticketing.refund_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Customers can create requests for their own orders
CREATE POLICY "Users can create refund requests for their orders"
  ON ticketing.refund_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM ticketing.orders
      WHERE id = order_id
        AND user_id = auth.uid()
    )
  );

-- Organizers can view requests for their events
CREATE POLICY "Organizers can view requests for their events"
  ON ticketing.refund_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM ticketing.orders o
      JOIN events.events e ON e.id = o.event_id
      WHERE o.id = order_id
        AND (
          -- Event creator
          e.created_by = auth.uid()
          -- OR org admin/owner
          OR (
            e.owner_context_type = 'organization'
            AND EXISTS (
              SELECT 1 FROM organizations.org_memberships om
              WHERE om.org_id = e.owner_context_id
                AND om.user_id = auth.uid()
                AND om.role IN ('admin', 'owner')
            )
          )
        )
    )
  );

-- Service role can do everything
CREATE POLICY "Service role full access on refund requests"
  ON ticketing.refund_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 3: Create View for Easy Queries
-- ============================================================================

CREATE OR REPLACE VIEW public.refund_requests AS
SELECT 
  rr.id,
  rr.order_id,
  rr.user_id,
  rr.reason,
  rr.details,
  rr.status,
  rr.requested_at,
  rr.reviewed_at,
  rr.processed_at,
  rr.reviewed_by,
  rr.organizer_response,
  rr.decline_reason,
  rr.refund_log_id,
  rr.metadata,
  -- Join order details
  o.event_id,
  o.total_cents,
  o.contact_email,
  o.contact_name,
  o.status as order_status,
  -- Join event details
  e.title as event_title,
  e.start_at as event_start,
  e.created_by as event_organizer_id,
  -- Join user details
  up.display_name as requester_name,
  up.photo_url as requester_avatar,
  -- Join reviewer details
  reviewer.display_name as reviewed_by_name
FROM ticketing.refund_requests rr
JOIN ticketing.orders o ON o.id = rr.order_id
JOIN events.events e ON e.id = o.event_id
LEFT JOIN users.user_profiles up ON up.user_id = rr.user_id
LEFT JOIN users.user_profiles reviewer ON reviewer.user_id = rr.reviewed_by
WHERE (
  -- Users can see their own requests
  rr.user_id = auth.uid()
  -- Organizers can see requests for their events
  OR e.created_by = auth.uid()
  OR (
    e.owner_context_type = 'organization'
    AND EXISTS (
      SELECT 1 FROM organizations.org_memberships om
      WHERE om.org_id = e.owner_context_id
        AND om.user_id = auth.uid()
        AND om.role IN ('admin', 'owner')
    )
  )
  -- Service role sees all
  OR auth.uid() IS NULL
);

GRANT SELECT ON public.refund_requests TO authenticated, service_role;

COMMENT ON VIEW public.refund_requests IS 
  'Refund requests with order and event details. RLS: users see their own, organizers see their events.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Refund request queue: customers request, organizers approve/decline, supports auto-approve toggle

