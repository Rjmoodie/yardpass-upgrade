# 🎫 Customer Refund Request Flow - Complete Plan

**Question:** How do attendees request refunds from organizers?  
**Answer:** Three options - pick one for v1

---

## 📊 **Three Approaches (Simple → Advanced)**

---

## **Option 1: Email-Based (Simplest - Launch Today)** ⏩

### **Customer Side:**
```
1. Customer goes to "My Tickets" in app
2. Clicks on ticket for event
3. Sees:
   
   ┌─────────────────────────────────────────┐
   │ Need a refund?                          │
   │                                         │
   │ Contact the organizer:                  │
   │ 📧 organizer@email.com                  │
   │                                         │
   │ [Copy Email]  [Send Email]              │
   └─────────────────────────────────────────┘
   
4. Clicks "Send Email" → Opens their email app with:
   - To: organizer@email.com
   - Subject: "Refund Request - [Event Name]"
   - Body: Pre-filled with order details
```

### **Organizer Side:**
```
1. Receives email from customer
2. Logs into dashboard → Refunds tab
3. Searches for customer email
4. Clicks "Refund" button
5. Done! (30 seconds)
```

### **Pros:**
- ✅ Zero development time (just show organizer email)
- ✅ Launch today
- ✅ Works for low volume
- ✅ Personal touch (organizer can reply)

### **Cons:**
- ⚠️ Extra step for customer (leave app)
- ⚠️ Organizer email gets cluttered
- ⚠️ No tracking of pending requests

**Time to implement:** 10 minutes (just add contact info to ticket page)

---

## **Option 2: In-App Request Form (Balanced - Recommended)** 🎯

### **Customer Side:**

**Location:** "My Tickets" page (`/tickets`)

```
Ticket Card:
┌────────────────────────────────────────────────────┐
│ 🎫 Ultimate Soccer Tailgate Experience            │
│ March 1, 2026 • General Admission                 │
│                                                    │
│ Status: Issued                                     │
│ QR Code: [███████]                                │
│                                                    │
│ [View Ticket]  [Request Refund]  ← NEW BUTTON     │
└────────────────────────────────────────────────────┘
```

**Click "Request Refund" → Modal opens:**

```
┌─────────────────────────────────────────────┐
│ Request Refund                          [×] │
├─────────────────────────────────────────────┤
│                                             │
│ Event: Ultimate Soccer Tailgate             │
│ Date: March 1, 2026                         │
│ Tickets: 1 × General Admission              │
│ Paid: $276.61                               │
│                                             │
│ ⚠️ Refund Policy:                           │
│ Refunds allowed until 24 hours before       │
│ event start. Processing takes 5-10 days.    │
│                                             │
│ Why are you requesting a refund?            │
│ ┌─────────────────────────────────────────┐ │
│ │ [Select reason ▼]                       │ │
│ │ • Can't attend                          │ │
│ │ • Event postponed/cancelled             │ │
│ │ • Duplicate purchase                    │ │
│ │ • Other (please explain)                │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Additional details: (optional)              │
│ ┌─────────────────────────────────────────┐ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ✅ What happens next:                       │
│ • Organizer will review your request       │
│ • You'll receive email notification        │
│ • If approved, refund processes in 5-10    │
│   business days                            │
│                                             │
│       [Cancel]    [Submit Request]          │
└─────────────────────────────────────────────┘
```

### **Database: Refund Requests Table**

**Create:** `ticketing.refund_requests`

```sql
CREATE TABLE ticketing.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ticketing.orders(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,  -- Dropdown selection
  details TEXT,          -- Optional explanation
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
  
  -- Workflow tracking
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  
  -- Response
  organizer_response TEXT,
  rejection_reason TEXT,
  
  -- Metadata
  metadata JSONB
);

CREATE INDEX idx_refund_requests_status ON ticketing.refund_requests(status);
CREATE INDEX idx_refund_requests_order ON ticketing.refund_requests(order_id);
CREATE INDEX idx_refund_requests_user ON ticketing.refund_requests(user_id);
```

### **Organizer Side:**

**New section in Refunds dashboard:**

```
Tabs:
├── Orders (existing)
├── Refund History (existing)
└── 🆕 Pending Requests ← NEW (shows badge with count)

┌──────────────────────────────────────────────────────────────┐
│ Pending Refund Requests                          [3 pending] │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Date     Customer         Event           Amount  Reason     Action      │
│ Nov 11   rodzrj@gmail.com  Soccer Tail    $276   Can't attend [Approve] │
│ Nov 11   test@test.com     Music Fest     $50    Duplicate    [Approve] │
│ Nov 10   jane@doe.com      Tech Conf      $262   Postponed    [Approve] │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Click "Approve" → Processes refund immediately**  
**Click row → Show details with [Approve] or [Reject] options**

### **Workflow:**
```
Customer → Submit Request → Status: "pending"
  ↓
Organizer → Reviews in dashboard → Sees reason
  ↓
Organizer → Clicks "Approve"
  ↓
Backend → Calls process-refund API
  ↓
Status → "processed"
  ↓
Customer → Receives refund email
```

### **Pros:**
- ✅ Professional, trackable process
- ✅ Organizer has control (approve/reject)
- ✅ Customer doesn't leave app
- ✅ Audit trail of all requests
- ✅ Can set auto-approve rules later

### **Cons:**
- ⏱️ More dev time (+60 min)
- ⏱️ Not instant for customer (requires organizer approval)

**Time to implement:** +60 minutes (request table + UI)

---

## **Option 3: Auto-Approve Self-Service (Advanced)** 🚀

### **Customer Side:**

**Same UI as Option 2, but:**

```
Click "Submit Request"
  ↓
✅ Instant auto-approval (if within rules)
  ↓
✅ Refund processes immediately
  ↓
✅ Toast: "Refund of $276 approved! You'll receive email confirmation."
```

### **Auto-Approve Rules:**
```typescript
Auto-approve IF:
  ✅ Not within 24h of event
  ✅ No tickets redeemed
  ✅ Event allows refunds (refund_policies.allow_refunds = true)
  ✅ Within refund window
  ✅ Customer hasn't requested >3 refunds this month (fraud check)

Otherwise:
  ⚠️ Send to organizer for manual review
```

### **Organizer Side:**

**Only sees exceptions:**
```
Pending Requests (Badge shows count)
├── Requests needing manual review
│   (e.g. within 24h window, suspicious patterns)
└── All others auto-processed (logged in history)
```

### **Pros:**
- ✅ Instant customer experience (like Eventbrite)
- ✅ Reduces organizer workload
- ✅ Scales better
- ✅ Better UX

### **Cons:**
- ⏱️ More complex rules engine
- ⚠️ Risk of abuse (need fraud checks)
- ⚠️ Less organizer control

**Time to implement:** +90 minutes (rules engine + fraud checks)

---

## 📊 **Comparison Table**

| Approach | Customer UX | Organizer Work | Dev Time | Risk |
|----------|-------------|----------------|----------|------|
| **Email-Based** | ⚠️ Manual | ⚠️ High | 10 min | Low |
| **In-App Request** | ✅ Good | ✅ Medium | 60 min | Low |
| **Auto-Approve** | ✅ Excellent | ✅ Low | 90 min | Medium |

---

## 💡 **My Recommendation: Hybrid Approach** 🎯

### **v1: In-App Request with Smart Defaults** (Best Balance)

**Implementation:**
```
Customer submits request
  ↓
Backend checks auto-approve rules
  ↓
IF meets all criteria → Auto-approve + instant refund ✅
ELSE → Queue for organizer review ⚠️
```

**Auto-Approve Criteria (Safe Defaults):**
- ✅ More than 48h before event
- ✅ No tickets redeemed
- ✅ Order less than 30 days old
- ✅ Customer has < 3 refunds in 90 days

**Manual Review Needed:**
- ⚠️ Within 48h of event
- ⚠️ Order older than 30 days
- ⚠️ Large order (>$500)
- ⚠️ Suspicious pattern (many refunds)

**Benefits:**
- ✅ ~80% refunds auto-approved (instant UX)
- ✅ ~20% go to organizer (edge cases)
- ✅ Fraud protection built in
- ✅ Organizer maintains control

---

## 🎯 **Recommended Implementation Plan**

### **What to Build:**

**1. Customer Side:** (~30 min)
- "Request Refund" button on ticket page
- Refund request modal with reason dropdown
- Status indicator ("Pending", "Approved", "Rejected")

**2. Backend:** (~30 min)
- `ticketing.refund_requests` table
- `submit_refund_request()` function
- Auto-approve logic (simple rules)
- Notification when request created

**3. Organizer Side:** (~60 min)
- Orders tab (view all orders, refund directly)
- Pending Requests tab (review queue)
- Refund History tab (audit log)
- Approve/Reject actions

**Total: 2 hours** (same as original plan, but includes customer flow)

---

## 🔄 **Complete User Flows**

### **Flow 1: Auto-Approved (80% of cases)**
```
Customer:
1. Clicks "Request Refund" in "My Tickets"
2. Selects reason, submits
3. ✅ Instant toast: "Refund approved! $276 will be refunded in 5-10 days"
4. Receives email confirmation
5. Ticket status changes to "Refunded"

Organizer:
- Doesn't see anything (auto-processed)
- Can view in Refund History later
```

### **Flow 2: Manual Review (20% of cases)**
```
Customer:
1. Clicks "Request Refund"
2. Selects reason, submits
3. ⚠️ Toast: "Refund request sent to organizer for review"
4. Status shows "Pending Review"

Organizer:
1. Sees badge "3 pending requests" in dashboard
2. Goes to Refunds → Pending Requests tab
3. Reviews request with customer's reason
4. Clicks "Approve" or "Reject"
5. If approved → Refund processes automatically
6. Customer receives email (approved or rejected)
```

---

## 📋 **Updated Database Schema**

```sql
CREATE TABLE ticketing.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ticketing.orders(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Request details
  reason TEXT NOT NULL CHECK (reason IN (
    'cant_attend', 
    'event_postponed', 
    'duplicate_purchase', 
    'not_as_described',
    'other'
  )),
  details TEXT,  -- Customer explanation
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Waiting for review
    'auto_approved',  -- Auto-approved by system
    'approved',       -- Manually approved by organizer
    'rejected',       -- Rejected by organizer
    'processed'       -- Refund completed
  )),
  
  -- Auto-approval metadata
  auto_approved BOOLEAN DEFAULT false,
  auto_approve_reason TEXT,  -- Why it was auto-approved
  
  -- Review workflow
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  
  -- Response
  organizer_response TEXT,
  rejection_reason TEXT,
  
  -- Link to actual refund (if processed)
  refund_log_id UUID REFERENCES ticketing.refund_log(id),
  
  -- Metadata
  metadata JSONB
);

CREATE INDEX idx_refund_requests_status ON ticketing.refund_requests(status);
CREATE INDEX idx_refund_requests_order ON ticketing.refund_requests(order_id);
CREATE INDEX idx_refund_requests_user ON ticketing.refund_requests(user_id);
CREATE INDEX idx_refund_requests_pending ON ticketing.refund_requests(status, requested_at) 
  WHERE status = 'pending';
```

---

## 🔧 **Auto-Approve Logic**

```sql
-- Function to check if request should be auto-approved
CREATE OR REPLACE FUNCTION ticketing.should_auto_approve_refund(
  p_order_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_event RECORD;
  v_recent_refunds INTEGER;
  v_hours_until_event NUMERIC;
BEGIN
  -- Get order
  SELECT * INTO v_order
  FROM ticketing.orders
  WHERE id = p_order_id;

  -- Get event
  SELECT * INTO v_event
  FROM events.events
  WHERE id = v_order.event_id;

  -- Check if any tickets redeemed
  IF EXISTS (
    SELECT 1 FROM ticketing.tickets
    WHERE order_id = p_order_id
      AND status = 'redeemed'
  ) THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', 'Tickets already redeemed - requires manual review'
    );
  END IF;

  -- Check time until event
  v_hours_until_event := EXTRACT(EPOCH FROM (v_event.start_at - now())) / 3600;

  IF v_hours_until_event < 48 THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', 'Within 48h of event - requires manual review'
    );
  END IF;

  -- Check order age (no refunds on old orders)
  IF v_order.created_at < now() - interval '30 days' THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', 'Order older than 30 days - requires manual review'
    );
  END IF;

  -- Check customer refund history (fraud prevention)
  SELECT COUNT(*) INTO v_recent_refunds
  FROM ticketing.refund_log
  WHERE initiated_by = p_user_id
    AND processed_at > now() - interval '90 days';

  IF v_recent_refunds >= 3 THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', 'Multiple recent refunds - requires manual review'
    );
  END IF;

  -- Check if order amount is high
  IF v_order.total_cents > 50000 THEN  -- > $500
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', 'High value order - requires manual review'
    );
  END IF;

  -- ✅ All checks passed - safe to auto-approve
  RETURN jsonb_build_object(
    'auto_approve', true,
    'reason', 'Meets all auto-approval criteria'
  );
END;
$$;
```

---

## 🎨 **Customer UI Components**

### **Location: TicketsPage.tsx**

Add to each ticket card:

```typescript
// In ticket card (existing component)
<Button
  variant="outline"
  onClick={() => setRefundModalOpen(true)}
  disabled={
    ticket.status === 'refunded' ||
    ticket.status === 'redeemed' ||
    isWithin24Hours(event.start_at)
  }
>
  {ticket.status === 'refunded' ? 'Refunded' : 'Request Refund'}
</Button>

// New modal component
<RefundRequestModal
  open={refundModalOpen}
  onClose={() => setRefundModalOpen(false)}
  ticket={ticket}
  order={order}
  event={event}
  onSuccess={() => {
    toast({ title: 'Refund request submitted' });
    refreshTickets();
  }}
/>
```

### **RefundRequestModal.tsx** (NEW)

```typescript
export function RefundRequestModal({ ticket, order, event, ... }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-refund-request', {
        body: {
          order_id: order.id,
          reason,
          details
        }
      });

      if (error) throw error;

      // Check if auto-approved
      if (data.auto_approved) {
        toast({
          title: 'Refund Approved!',
          description: `Your refund of $${data.amount} has been approved. You'll receive confirmation via email.`
        });
      } else {
        toast({
          title: 'Request Submitted',
          description: 'The organizer will review your request and respond within 24 hours.'
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      toast({
        title: 'Request Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ... modal UI with reason dropdown, details, submit button
}
```

---

## 📡 **Real-Time Notifications**

### **For Organizers:**

When customer submits request:

```typescript
// Subscribe to refund requests for my events
const channel = supabase
  .channel('refund-requests')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'ticketing',
      table: 'refund_requests',
      filter: `status=eq.pending`
    },
    (payload) => {
      // Show toast notification
      toast({
        title: 'New Refund Request',
        description: `${payload.new.email} requested refund for ${event.title}`
      });
      
      // Update badge count
      refetchPendingCount();
    }
  )
  .subscribe();
```

### **For Customers:**

When organizer approves/rejects:

```typescript
// Subscribe to their own refund requests
const channel = supabase
  .channel('my-refund-requests')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'ticketing',
      table: 'refund_requests',
      filter: `user_id=eq.${user.id}`
    },
    (payload) => {
      if (payload.new.status === 'approved') {
        toast({
          title: 'Refund Approved!',
          description: 'Your refund has been processed.'
        });
      }
    }
  )
  .subscribe();
```

---

## ⏱️ **Time Estimates by Option**

| Option | Customer UI | Organizer UI | Backend | Total |
|--------|-------------|--------------|---------|-------|
| **1. Email-Based** | 10 min | 2h | 0 min | **2h 10min** |
| **2. Request Form** | 30 min | 2h 30min | 30 min | **3h** |
| **3. Auto-Approve** | 30 min | 2h 30min | 60 min | **3h 30min** |

---

## 🎯 **My Strong Recommendation**

### **Build Option 2: In-App Request Form with Smart Auto-Approve** 

**Why:**
- ✅ Professional, trackable
- ✅ ~80% auto-approved (instant UX)
- ✅ ~20% manual review (organizer control)
- ✅ Fraud protection built in
- ✅ Scales well
- ✅ Only +1 hour more than basic dashboard

**Implementation:**
1. Customer: "Request Refund" button + modal (~30 min)
2. Backend: Request table + auto-approve logic (~30 min)
3. Organizer: 3-tab dashboard (Orders, Requests, History) (~2h 30min)

**Total: 3 hours** (instead of 2h for organizer-only)

---

## 📋 **Updated Component List**

### **Customer Side (NEW):**
- `src/components/tickets/RefundRequestModal.tsx`
- `src/components/tickets/RefundStatusBadge.tsx`

### **Organizer Side (AS PLANNED):**
- `src/pages/new-design/OrganizerRefundsPage.tsx`
- `src/components/organizer/OrdersTable.tsx`
- `src/components/organizer/PendingRefundRequests.tsx` ← ADDED
- `src/components/organizer/RefundHistoryTable.tsx`
- `src/components/organizer/RefundConfirmationModal.tsx`

### **Backend (NEW):**
- Edge Function: `submit-refund-request`
- RPC: `should_auto_approve_refund()`
- Table: `ticketing.refund_requests`

---

## ✅ **Final Recommendation**

**Build the complete flow (3 hours):**
- ✅ Customer request form
- ✅ Auto-approve for 80% of cases
- ✅ Organizer review queue for 20%
- ✅ Complete audit trail

**This gives you:**
- Best customer experience (mostly instant)
- Organizer control (for edge cases)
- Fraud protection
- Professional, scalable system

---

**Approve this approach and I'll build the complete system (3 hours)?** 🔨

Or prefer simpler email-based for now and build later? 📧

