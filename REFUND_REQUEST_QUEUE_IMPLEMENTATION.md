# 🎫 Refund Request Queue - Implementation Plan v1

**Approach:** Request/Approval workflow  
**Customer:** Raises request → Status: "Pending"  
**Organizer:** Reviews → Approves or Declines  
**Time:** ~3 hours total

---

## 🔄 **Complete Flow**

```
CUSTOMER SIDE:
1. Goes to "My Tickets"
2. Clicks "Request Refund" on ticket
3. Fills reason + details
4. Submits → Status: "Pending Review"
5. Sees: "Refund request sent to organizer"
   ↓
ORGANIZER SIDE:
1. Sees badge: "3 Pending Requests" in dashboard
2. Goes to Dashboard → Refunds → Requests tab
3. Reviews request (sees reason, order details)
4. Clicks "Approve" or "Decline"
   ↓
IF APPROVED:
  → Calls process-refund API
  → Stripe processes refund
  → Database updated
  → Inventory released
  → Email sent to customer
   ↓
CUSTOMER:
  → Receives email: "Refund approved!"
  → Ticket status: "Refunded"
  → Money returns in 5-10 days
```

---

## 🗄️ **Database Schema**

### **Migration:** `supabase/migrations/20251111000010_refund_requests.sql`

```sql
-- ============================================================================
-- REFUND REQUEST QUEUE
-- ============================================================================
-- Allows attendees to request refunds, organizers to approve/decline
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
  metadata JSONB
);

-- Indexes for performance
CREATE INDEX idx_refund_requests_order ON ticketing.refund_requests(order_id);
CREATE INDEX idx_refund_requests_user ON ticketing.refund_requests(user_id);
CREATE INDEX idx_refund_requests_status ON ticketing.refund_requests(status);
CREATE INDEX idx_refund_requests_pending ON ticketing.refund_requests(status, requested_at) 
  WHERE status = 'pending';

COMMENT ON TABLE ticketing.refund_requests IS 
  'Customer refund requests. Organizers approve/decline in dashboard. On approval, refund processes automatically.';

-- Grant permissions
GRANT SELECT ON ticketing.refund_requests TO authenticated, service_role;
GRANT INSERT ON ticketing.refund_requests TO authenticated, service_role;
GRANT UPDATE ON ticketing.refund_requests TO service_role;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE ticketing.refund_requests ENABLE ROW LEVEL SECURITY;

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
          e.created_by = auth.uid()
          OR (
            e.owner_context_type = 'organization'
            AND EXISTS (
              SELECT 1 FROM organization_members om
              WHERE om.organization_id = e.owner_context_id
                AND om.user_id = auth.uid()
                AND om.role IN ('admin', 'owner')
            )
          )
        )
    )
  );

-- Service role can do everything
CREATE POLICY "Service role full access"
  ON ticketing.refund_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VIEW FOR EASY QUERIES
-- ============================================================================

CREATE OR REPLACE VIEW public.refund_requests AS
SELECT 
  rr.*,
  o.event_id,
  o.total_cents,
  o.contact_email,
  o.status as order_status,
  e.title as event_title,
  e.start_at as event_start,
  e.created_by as event_organizer_id,
  up.display_name as requester_name,
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
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = e.owner_context_id
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
```

---

## 🔧 **Backend Functions**

### **Function 1: Submit Refund Request**

**File:** `supabase/functions/submit-refund-request/index.ts` (NEW)

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, reason, details } = await req.json();
    
    if (!order_id || !reason) {
      throw new Error("order_id and reason are required");
    }

    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authentication required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      authHeader.replace("Bearer ", ""),
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      throw new Error("Authentication failed");
    }

    console.log(`[submit-refund-request] User ${user.id} requesting refund for order ${order_id}`);

    // Use service role to bypass RLS for validation
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Validate order belongs to user
    const { data: order, error: orderErr } = await supabaseService
      .from("orders")
      .select(`
        *,
        events:event_id(id, title, start_at)
      `)
      .eq("id", order_id)
      .eq("user_id", user.id)  // Security: only their orders
      .single();

    if (orderErr || !order) {
      throw new Error("Order not found or you don't have permission");
    }

    // Check if already refunded
    if (order.status === 'refunded') {
      return new Response(
        JSON.stringify({
          status: 'already_refunded',
          message: 'This order has already been refunded'
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if request already exists
    const { data: existingRequest } = await supabaseService
      .from("refund_requests")
      .select("id, status")
      .eq("order_id", order_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      return new Response(
        JSON.stringify({
          status: 'already_requested',
          message: 'A refund request is already pending for this order',
          request_id: existingRequest.id
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check basic eligibility
    const { data: eligibility } = await supabaseService
      .rpc('check_refund_eligibility', {
        p_order_id: order.id,
        p_user_id: user.id
      });

    if (!eligibility?.eligible) {
      return new Response(
        JSON.stringify({
          status: 'not_eligible',
          reason: eligibility?.reason || 'Refund not allowed',
          details: eligibility
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create refund request
    const { data: request, error: insertErr } = await supabaseService
      .from("refund_requests")
      .insert({
        order_id,
        user_id: user.id,
        reason,
        details,
        status: 'pending',
        metadata: {
          event_title: order.events?.title,
          event_start: order.events?.start_at,
          order_total_cents: order.total_cents
        }
      })
      .select()
      .single();

    if (insertErr) {
      throw new Error(`Failed to create request: ${insertErr.message}`);
    }

    console.log(`[submit-refund-request] ✅ Request created: ${request.id}`);

    // TODO: Send notification to organizer
    // (Email or push notification that they have a pending request)

    return new Response(
      JSON.stringify({
        status: 'success',
        request_id: request.id,
        message: 'Refund request submitted. The organizer will review and respond within 24 hours.'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("[submit-refund-request] ERROR:", error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
```

---

### **Function 2: Review Refund Request (Approve/Decline)**

**File:** `supabase/functions/review-refund-request/index.ts` (NEW)

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { request_id, action, organizer_response } = await req.json();
    
    if (!request_id || !action) {
      throw new Error("request_id and action (approve/decline) required");
    }

    if (!['approve', 'decline'].includes(action)) {
      throw new Error("action must be 'approve' or 'decline'");
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      authHeader.replace("Bearer ", ""),
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) throw new Error("Authentication failed");

    console.log(`[review-refund-request] ${action} by user ${user.id} for request ${request_id}`);

    // Get request with order and event details
    const { data: request, error: reqErr } = await supabaseService
      .from("refund_requests")
      .select(`
        *,
        orders:order_id(
          *,
          events:event_id(
            id,
            title,
            created_by,
            owner_context_type,
            owner_context_id
          )
        )
      `)
      .eq("id", request_id)
      .single();

    if (reqErr || !request) {
      throw new Error("Refund request not found");
    }

    // Check authorization (same as process-refund)
    const isEventCreator = request.orders?.events?.created_by === user.id;
    let isOrgAdmin = false;

    if (request.orders?.events?.owner_context_type === 'organization') {
      const { data: orgMember } = await supabaseService
        .from('organization_members')
        .select('role')
        .eq('organization_id', request.orders.events.owner_context_id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      isOrgAdmin = orgMember?.role === 'admin' || orgMember?.role === 'owner';
    }

    const { data: userProfile } = await supabaseService
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();
    
    const isPlatformAdmin = userProfile?.is_admin === true;

    if (!isEventCreator && !isOrgAdmin && !isPlatformAdmin) {
      throw new Error("Not authorized to review this refund request");
    }

    console.log(`[review-refund-request] Authorization passed`);

    // Check if already reviewed
    if (request.status !== 'pending') {
      return new Response(
        JSON.stringify({
          status: 'already_reviewed',
          current_status: request.status,
          reviewed_at: request.reviewed_at
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // APPROVE PATH
    // ========================================================================
    
    if (action === 'approve') {
      console.log(`[review-refund-request] Approving request ${request_id}`);

      // Mark as approved first
      await supabaseService
        .from("refund_requests")
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          organizer_response
        })
        .eq("id", request_id);

      // Process the actual refund via existing process-refund logic
      const { data: refundData, error: refundErr } = await supabaseService.functions.invoke('process-refund', {
        body: {
          order_id: request.order_id,
          reason: `Customer request: ${request.reason}${request.details ? ' - ' + request.details : ''}`
        }
      });

      if (refundErr) {
        // Refund failed - mark as pending again
        await supabaseService
          .from("refund_requests")
          .update({ status: 'pending' })
          .eq("id", request_id);
        
        throw new Error(`Refund processing failed: ${refundErr.message}`);
      }

      // Link to refund log (if available)
      // The refund_log entry was created by process_ticket_refund
      const { data: refundLog } = await supabaseService
        .from("refund_log")
        .select("id")
        .eq("order_id", request.order_id)
        .order("processed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (refundLog) {
        await supabaseService
          .from("refund_requests")
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            refund_log_id: refundLog.id
          })
          .eq("id", request_id);
      }

      console.log(`[review-refund-request] ✅ Approved and processed`);

      return new Response(
        JSON.stringify({
          status: 'approved',
          refund: refundData?.refund,
          message: 'Refund approved and processed. Customer will receive email confirmation.'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // DECLINE PATH
    // ========================================================================
    
    if (action === 'decline') {
      console.log(`[review-refund-request] Declining request ${request_id}`);

      await supabaseService
        .from("refund_requests")
        .update({
          status: 'declined',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          organizer_response,
          decline_reason: organizer_response || 'Refund request declined'
        })
        .eq("id", request_id);

      // TODO: Send email to customer about decline
      // await supabaseService.functions.invoke('send-refund-decline-notification', { ... })

      console.log(`[review-refund-request] ✅ Declined`);

      return new Response(
        JSON.stringify({
          status: 'declined',
          message: 'Refund request declined'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("[review-refund-request] ERROR:", error);
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
```

---

## 🎨 **Frontend Components**

### **Customer Side: My Tickets**

**File:** `src/pages/new-design/TicketsPage.tsx` (UPDATE)

Add to each ticket card:

```typescript
<Button
  variant="outline"
  onClick={() => {
    setSelectedTicket(ticket);
    setRefundRequestModalOpen(true);
  }}
  disabled={
    ticket.status === 'refunded' ||
    ticket.status === 'redeemed' ||
    hasWithin24Hours(event.start_at) ||
    hasPendingRefundRequest(ticket.order_id)
  }
>
  {ticket.refund_request_status === 'pending' ? 'Pending Review' :
   ticket.status === 'refunded' ? 'Refunded' :
   'Request Refund'}
</Button>

{ticket.refund_request_status === 'pending' && (
  <Badge variant="warning" className="mt-2">
    Refund request pending
  </Badge>
)}

{ticket.refund_request_status === 'declined' && (
  <Badge variant="danger" className="mt-2">
    Refund request declined
  </Badge>
)}
```

---

### **Customer Side: Refund Request Modal**

**File:** `src/components/tickets/RefundRequestModal.tsx` (NEW)

```typescript
interface RefundRequestModalProps {
  open: boolean;
  onClose: () => void;
  ticket: Ticket;
  order: Order;
  event: Event;
  onSuccess: () => void;
}

export function RefundRequestModal({ open, onClose, ticket, order, event, onSuccess }: RefundRequestModalProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasonOptions = [
    { value: 'cant_attend', label: "Can't attend" },
    { value: 'event_postponed', label: 'Event postponed' },
    { value: 'event_cancelled', label: 'Event cancelled' },
    { value: 'duplicate_purchase', label: 'Duplicate purchase' },
    { value: 'not_as_described', label: 'Not as described' },
    { value: 'other', label: 'Other reason' },
  ];

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: 'Please select a reason', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-refund-request', {
        body: {
          order_id: order.id,
          reason,
          details: details.trim() || null
        }
      });

      if (error) throw error;

      toast({
        title: 'Request Submitted',
        description: 'The organizer will review your refund request and respond within 24 hours.'
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Request Failed',
        description: err.message || 'Failed to submit refund request',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Refund</DialogTitle>
          <DialogDescription>
            Request a refund for your ticket. The organizer will review and respond within 24 hours.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Event</span>
              <span className="font-medium">{event.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span>{formatDate(event.start_at)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tickets</span>
              <span>{order.tickets_count}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>Refund Amount</span>
              <span>${(order.total_cents / 100).toFixed(2)}</span>
            </div>
          </div>

          {/* Refund Policy Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-900">
              ⚠️ <strong>Refund Policy:</strong> Refunds allowed until 24 hours before event start. 
              Processing takes 5-10 business days after approval.
            </p>
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Why are you requesting a refund?</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {reasonOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Details */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional details (optional)</label>
            <Textarea
              placeholder="Explain your situation..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
            />
          </div>

          {/* What Happens Next */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-1">
            <p className="text-xs font-semibold text-green-900">✅ What happens next:</p>
            <ul className="text-xs text-green-800 space-y-1 ml-4">
              <li>• Organizer will review your request</li>
              <li>• You'll receive email notification (approved or declined)</li>
              <li>• If approved, refund processes in 5-10 business days</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!reason || submitting}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 🎯 **Organizer Side: Updated Dashboard**

### **3-Tab Structure:**

```
Refunds Dashboard:
├── Tab 1: Orders (direct refund - existing plan)
├── Tab 2: Pending Requests ← NEW (approval queue)
└── Tab 3: Refund History (audit log - existing plan)
```

### **Tab 2: Pending Requests**

**Component:** `src/components/organizer/PendingRefundRequests.tsx` (NEW)

```typescript
export function PendingRefundRequests() {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('refund_requests')  // Uses RLS view
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });
    
    setRequests(data || []);
  };

  const handleReview = async (requestId: string, action: 'approve' | 'decline', response?: string) => {
    const { data, error } = await supabase.functions.invoke('review-refund-request', {
      body: {
        request_id: requestId,
        action,
        organizer_response: response
      }
    });

    if (error) {
      toast({ title: 'Review failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: action === 'approve' ? 'Refund Approved' : 'Request Declined',
      description: action === 'approve' 
        ? `Refund of $${data.refund?.amount} processed successfully.`
        : 'Customer has been notified.'
    });

    fetchRequests();
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pending Refund Requests</h3>
        <Badge variant="warning">{requests.length} pending</Badge>
      </div>

      {/* Requests Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map(req => (
            <TableRow key={req.id}>
              <TableCell>{formatDate(req.requested_at)}</TableCell>
              <TableCell>{req.contact_email}</TableCell>
              <TableCell>{req.event_title}</TableCell>
              <TableCell>${(req.total_cents / 100).toFixed(2)}</TableCell>
              <TableCell>
                <Badge variant="neutral">
                  {formatReason(req.reason)}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => {
                      setSelectedRequest(req);
                      setReviewModalOpen(true);
                    }}
                  >
                    Review
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Review Modal */}
      <RefundReviewModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        request={selectedRequest}
        onReview={handleReview}
      />
    </div>
  );
}
```

---

## 📊 **Complete Component List**

### **Customer Side (NEW):**
```
src/components/tickets/
├── RefundRequestModal.tsx          ← Request form
└── RefundStatusBadge.tsx          ← Status indicator
```

### **Organizer Side:**
```
src/pages/new-design/
└── OrganizerRefundsPage.tsx       ← Main container (3 tabs)

src/components/organizer/
├── OrdersTable.tsx                 ← Direct refund (Tab 1)
├── PendingRefundRequests.tsx      ← Approval queue (Tab 2) ← NEW
├── RefundHistoryTable.tsx         ← Audit log (Tab 3)
├── RefundConfirmationModal.tsx    ← Approve direct refund
└── RefundReviewModal.tsx          ← Approve/Decline request ← NEW
```

### **Backend:**
```
supabase/migrations/
└── 20251111000010_refund_requests.sql

supabase/functions/
├── submit-refund-request/          ← Customer submits
├── review-refund-request/          ← Organizer approves/declines
├── process-refund/                 ← (Already exists)
└── send-refund-confirmation/       ← (Already exists)
```

---

## ⏱️ **Updated Time Estimate**

| Phase | Tasks | Time |
|-------|-------|------|
| **Database** | Refund requests table + RLS | 20 min |
| **Backend** | submit-refund-request, review-refund-request | 40 min |
| **Customer UI** | Request modal, status badges | 30 min |
| **Organizer UI** | 3-tab dashboard (Orders, Requests, History) | 90 min |
| **Integration** | Routes, navigation, real-time | 20 min |
| **Testing** | End-to-end flows | 20 min |
| **TOTAL** | | **~3.5 hours** |

---

## 🎯 **Final Approval Needed**

This plan gives you:

**Customer Experience:**
- ✅ "Request Refund" button on every ticket
- ✅ Simple form with reason dropdown
- ✅ Status tracking ("Pending", "Approved", "Declined")
- ✅ Email notifications

**Organizer Experience:**
- ✅ View all orders (direct refund option)
- ✅ Pending requests queue (review + approve/decline)
- ✅ Complete refund history
- ✅ Real-time notifications when requests come in

**System:**
- ✅ Full audit trail
- ✅ Organizer maintains control
- ✅ Professional workflow
- ✅ Scalable

---

**Approve and I'll implement the complete flow (3.5 hours)?** 🔨

Or simplify to email-based and build this later? 📧

