# 🎫 Organizer Refund Dashboard - Implementation Plan

**Target Users:** Event organizers + appointed managers  
**Location:** `/dashboard/refunds` (new tab in Organizer Dashboard)  
**Time Estimate:** ~2 hours total  
**Status:** Awaiting approval to implement

---

## 👥 **Who Can Access**

### **Authorization Model:**

```typescript
User can access refunds IF:
  ✅ User created the event (event.created_by = user.id), OR
  ✅ User is org admin/owner for the event's organization, OR
  ✅ User has 'manager' role for specific event (via role_invites), OR
  ✅ User is platform admin
```

**Uses existing permissions:**
- Event creator check: `events.created_by`
- Org membership: `organization_members` table
- Event managers: `role_invites` table (staff, manager, admin roles)
- Platform admin: `user_profiles.is_admin`

**No new permission system needed!** ✅

---

## 🎨 **UI Design: Where It Goes**

### **Navigation Structure:**

```
Organizer Dashboard (/dashboard)
├── Events (current)
├── Analytics (current)
├── Sponsorships (current)
├── Settings (current)
└── 🆕 Refunds & Orders ← NEW TAB
    ├── Orders List (all orders for my events)
    ├── Refund History (processed refunds)
    └── Refund Requests (if customer self-service enabled later)
```

### **Add New Tab to Organizer Dashboard:**

**File:** `src/pages/new-design/OrganizerDashboard.tsx`

```typescript
const tabs = [
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'analytics', label: 'Analytics', icon: BarChart },
  { id: 'sponsorships', label: 'Sponsorships', icon: DollarSign },
  { id: 'refunds', label: 'Refunds', icon: RefreshCcw },  // ← NEW
  { id: 'settings', label: 'Settings', icon: Settings },
];
```

---

## 📊 **Feature Set: What Organizers See**

### **Tab 1: Orders Management** 📦

**Purpose:** View and manage all ticket orders for organizer's events

**Features:**
```
┌─────────────────────────────────────────────────────────────┐
│ Orders for Your Events                          [Filter ▼] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Filters:                                                     │
│ • Event: [All Events ▼]                                     │
│ • Status: [All ▼] Paid | Refunded | Pending                 │
│ • Date Range: [Last 30 days ▼]                              │
│ • Search: [Email, Order ID...]                              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Order List (Table):                                         │
│                                                              │
│ Date       | Customer      | Event        | Amount | Status | Actions     │
│ Nov 11     | rodzrj@gmail  | Soccer Tail  | $276   | Paid   | [Refund]   │
│ Nov 11     | test@test.com | Soccer Tail  | $276   | Paid   | [Refund]   │
│ Nov 10     | john@doe.com  | Music Fest   | $50    | Refunded | [View]   │
│ Nov 9      | jane@doe.com  | Music Fest   | $100   | Paid   | [Refund]   │
│                                                              │
│ Showing 1-10 of 45 orders                      [1][2][3]    │
└─────────────────────────────────────────────────────────────┘
```

**Columns:**
- Order Date
- Customer Email
- Event Title
- # of Tickets
- Total Amount
- Status (Paid, Refunded, Pending)
- Actions (Refund button, View details)

**Interactions:**
- Click row → Expand to show order details, tickets, timeline
- Click "Refund" → Opens confirmation modal
- Click event title → Navigate to event details

---

### **Tab 2: Refund History** 📜

**Purpose:** View all processed refunds with audit trail

**Features:**
```
┌─────────────────────────────────────────────────────────────┐
│ Refund History                                   [Export]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Filters:                                                     │
│ • Event: [All Events ▼]                                     │
│ • Type: [All ▼] Admin | Organizer | Dispute                 │
│ • Date Range: [Last 30 days ▼]                              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Refund List:                                                │
│                                                              │
│ Date       | Customer      | Event      | Amount | Type     | Reason          │
│ Nov 11     | test@test.com | Soccer     | $276   | Organizer| Customer request │
│ Nov 10     | john@doe.com  | Music Fest | $50    | Admin    | Event cancelled  │
│ Nov 9      | jane@doe.com  | Music Fest | $100   | Organizer| Can't attend     │
│                                                              │
│ Summary: 3 refunds, $426 total                              │
└─────────────────────────────────────────────────────────────┘
```

**Columns:**
- Refund Date
- Customer Email
- Event Title
- Refund Amount
- Refund Type (Admin/Organizer/Dispute)
- Reason
- Tickets Refunded
- Initiated By (name)

**Summary Stats:**
- Total refunds (count)
- Total amount refunded
- Refund rate % by event
- Most common reasons

---

### **Refund Confirmation Modal** 💬

**Triggered when:** Organizer clicks "Refund" button

```
┌───────────────────────────────────────────┐
│ Confirm Refund                        [×] │
├───────────────────────────────────────────┤
│                                           │
│ Are you sure you want to refund this      │
│ order?                                    │
│                                           │
│ Order Details:                            │
│ • Customer: rodzrj@gmail.com              │
│ • Event: Ultimate Soccer Tailgate         │
│ • Tickets: 1 × General Admission          │
│ • Amount: $276.61                         │
│                                           │
│ ⚠️ This action cannot be undone.          │
│                                           │
│ Reason for refund: (optional)             │
│ ┌─────────────────────────────────────┐   │
│ │ Customer requested refund            │   │
│ └─────────────────────────────────────┘   │
│                                           │
│ What will happen:                         │
│ ✅ Stripe will refund $276.61            │
│ ✅ Tickets will be cancelled             │
│ ✅ Inventory will be released            │
│ ✅ Customer receives email confirmation   │
│                                           │
│ Processing time: 5-10 business days      │
│                                           │
│         [Cancel]    [Confirm Refund]      │
└───────────────────────────────────────────┘
```

**Features:**
- Shows order summary
- Optional reason field
- Clear explanation of what happens
- Loading state during processing
- Success/error toast notifications

---

## 🔧 **Technical Implementation**

### **Step 1: New Page Component** (~45 min)

**File:** `src/pages/new-design/OrganizerRefundsPage.tsx` (NEW)

**Structure:**
```typescript
export function OrganizerRefundsPage() {
  const [activeTab, setActiveTab] = useState<'orders' | 'history'>('orders');
  const [orders, setOrders] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // Fetch orders for organizer's events
  const fetchOrders = async () => {
    // Get all events created by user or where user is org admin
    const { data: myEvents } = await supabase
      .from('events')
      .select('id')
      .or(`created_by.eq.${user.id},owner_context_id.in.(${userOrgIds})`);
    
    const eventIds = myEvents.map(e => e.id);
    
    // Get orders for these events
    const { data: orders } = await supabase
      .from('orders')
      .select(`
        *,
        events:event_id(title, start_at),
        tickets:tickets(count)
      `)
      .in('event_id', eventIds)
      .order('created_at', { ascending: false });
    
    setOrders(orders);
  };
  
  // Fetch refund history
  const fetchRefunds = async () => {
    const { data: refunds } = await supabase
      .from('refund_log')  // Uses the RLS view we created
      .select('*')
      .order('processed_at', { ascending: false });
    
    setRefunds(refunds);
  };
  
  // Process refund via API
  const handleRefund = async (orderId: string, reason: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: { order_id: orderId, reason }
      });
      
      if (error) throw error;
      
      toast({
        title: 'Refund Processed',
        description: `Refund of $${data.refund.amount} initiated successfully.`
      });
      
      // Refresh data
      await fetchOrders();
      await fetchRefunds();
      
    } catch (err) {
      toast({
        title: 'Refund Failed',
        description: err.message,
        variant: 'destructive'
      });
    }
  };
  
  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="history">Refund History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="orders">
          <OrdersTable 
            orders={orders}
            onRefund={(order) => {
              setSelectedOrder(order);
              setRefundModalOpen(true);
            }}
          />
        </TabsContent>
        
        <TabsContent value="history">
          <RefundHistoryTable refunds={refunds} />
        </TabsContent>
      </Tabs>
      
      <RefundConfirmationModal
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        order={selectedOrder}
        onConfirm={handleRefund}
      />
    </div>
  );
}
```

---

### **Step 2: Add Route** (~5 min)

**File:** `src/App.tsx` or route config

```typescript
<Route 
  path="/dashboard/refunds" 
  element={<OrganizerRefundsPage />} 
/>
```

---

### **Step 3: Add Tab to Dashboard** (~5 min)

**File:** `src/pages/new-design/OrganizerDashboard.tsx`

Update the navigation tabs to include "Refunds":

```typescript
// Add to existing tabs array
{ 
  id: 'refunds', 
  label: 'Refunds', 
  icon: RefreshCcw,
  path: '/dashboard/refunds'
}
```

---

### **Step 4: Sub-Components** (~60 min)

#### **A. OrdersTable Component** (~20 min)
```typescript
interface OrdersTableProps {
  orders: Order[];
  onRefund: (order: Order) => void;
}

export function OrdersTable({ orders, onRefund }: OrdersTableProps) {
  // Features:
  // - Sortable columns
  // - Expandable rows (show order details)
  // - Status badges (Paid = green, Refunded = gray)
  // - Refund button (disabled if already refunded or redeemed)
  // - Search/filter
}
```

#### **B. RefundHistoryTable Component** (~15 min)
```typescript
interface RefundHistoryTableProps {
  refunds: RefundLog[];
}

export function RefundHistoryTable({ refunds }: RefundHistoryTableProps) {
  // Features:
  // - Timeline view
  // - Refund type badges (Admin/Organizer/Dispute)
  // - Export to CSV
  // - Summary stats
}
```

#### **C. RefundConfirmationModal Component** (~25 min)
```typescript
interface RefundConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  onConfirm: (orderId: string, reason: string) => Promise<void>;
}

export function RefundConfirmationModal({ ... }: RefundConfirmationModalProps) {
  // Features:
  // - Shows order summary
  // - Reason input (optional)
  // - What will happen explanation
  // - Loading state during refund
  // - Success/error handling
}
```

---

## 📱 **Detailed Feature Breakdown**

### **Feature 1: Orders Table with Filters**

**What organizers see:**
```
┌──────────────────────────────────────────────────────────────────┐
│ 📦 Orders for Your Events                                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ [🔍 Search by email, name, order ID...]                         │
│                                                                   │
│ Filter by:  [All Events ▼]  [All Status ▼]  [Last 30 Days ▼]   │
│                                                                   │
│ ────────────────────────────────────────────────────────────────│
│                                                                   │
│ Date ↓     Customer           Event              Amt    Status  Action    │
│ Nov 11     rodzrj@gmail.com   Soccer Tailgate   $276    💚 Paid  [Refund] │
│ Nov 11     test@test.com      Soccer Tailgate   $276    💚 Paid  [Refund] │
│ Nov 10     john@doe.com       Music Festival    $50     ⚪ Refunded [View] │
│ Nov 9      jane@doe.com       Tech Conf         $262    💚 Paid  [Refund] │
│ Nov 8      alice@test.com     Tech Conf         $262    🔴 Redeemed ━━━   │
│                                                                   │
│ Showing 1-5 of 45 orders                        [← 1 2 3 →]     │
└──────────────────────────────────────────────────────────────────┘
```

**Smart Features:**
- ✅ "Refund" button **disabled** if:
  - Order already refunded
  - Any ticket already redeemed
  - Within 24h of event (unless organizer has override)
- ✅ Tooltip explains why button is disabled
- ✅ Click row to expand and see:
  - Individual tickets
  - Payment details
  - Customer contact info
  - Refund eligibility status

---

### **Feature 2: Quick Refund Action**

**Organizer clicks "Refund" button:**

```
┌─────────────────────────────────────────────┐
│ Confirm Refund                          [×] │
├─────────────────────────────────────────────┤
│                                             │
│ 📧 rodzrj@gmail.com                         │
│ 🎫 Ultimate Soccer Tailgate Experience      │
│ 📅 March 1, 2026 at 3:30 PM                 │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Order Summary:                          │ │
│ │ • 1× General Admission ($250.00)        │ │
│ │ • Platform Fee ($21.29)                 │ │
│ │ • Payment Processing ($5.32)            │ │
│ │ ─────────────────────────────────────── │ │
│ │ Total Refund: $276.61                   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Reason (optional):                          │
│ ┌─────────────────────────────────────────┐ │
│ │ Customer requested - can't attend       │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ℹ️ What happens next:                       │
│ ✅ Stripe processes refund immediately      │
│ ✅ Tickets cancelled automatically          │
│ ✅ Inventory released (1 ticket available)  │
│ ✅ Customer receives email confirmation     │
│ ⏱️ Refund appears in 5-10 business days     │
│                                             │
│ ⚠️ Platform & payment fees will be          │
│    refunded to customer.                    │
│                                             │
│        [Cancel]    [💳 Process Refund]      │
└─────────────────────────────────────────────┘
```

**Behavior:**
1. Organizer clicks "Process Refund"
2. Button shows loading spinner
3. Calls `process-refund` API
4. Shows toast: "Refund processing..."
5. On success: Green toast "Refund of $X processed!"
6. Table updates automatically (order status changes)
7. Email confirmation sent to customer

---

### **Feature 3: Refund History & Analytics**

```
┌──────────────────────────────────────────────────────────────────┐
│ 📜 Refund History                                    [Export CSV]│
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Summary (Last 30 Days):                                          │
│ ┌──────────┬──────────┬──────────┬──────────────────┐            │
│ │ Refunds  │  Amount  │   Rate   │  Avg Process Time│            │
│ │    3     │  $426    │   6.7%   │     < 1 min      │            │
│ └──────────┴──────────┴──────────┴──────────────────┘            │
│                                                                   │
│ ────────────────────────────────────────────────────────────────│
│                                                                   │
│ Date       Event              Customer          Amt     Type     Reason         │
│ Nov 11     Soccer Tailgate    rodzrj@...       $276    You      Can't attend   │
│ Nov 10     Music Festival     john@...         $50     Admin    Event cancel   │
│ Nov 9      Tech Conference    jane@...         $262    You      Duplicate      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Analytics Shown:**
- Total refunds (count + amount)
- Refund rate % (refunds / total orders)
- Average processing time
- Breakdown by refund type
- Breakdown by reason
- Trend over time (optional chart)

---

## 🔐 **Security & Authorization**

### **Backend (Already Built):**
✅ `process-refund` Edge Function checks:
- User is event creator, OR
- User is org admin, OR
- User is platform admin

### **Frontend (To Build):**
```typescript
// Before showing refund button, check eligibility
const { data: eligibility } = await supabase.rpc('check_refund_eligibility', {
  p_order_id: order.id,
  p_user_id: user.id
});

// Disable button if not eligible
<Button
  disabled={!eligibility?.eligible}
  onClick={() => handleRefund(order.id)}
>
  {eligibility?.eligible ? 'Refund' : 'Not Eligible'}
</Button>

// Show tooltip with reason
{!eligibility?.eligible && (
  <Tooltip content={eligibility?.reason} />
)}
```

---

## 📊 **Data Queries**

### **Query 1: Get Orders for Organizer**
```sql
-- Returns all orders for events the user manages
SELECT 
  o.*,
  e.title as event_title,
  e.start_at as event_start,
  (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = o.id) as ticket_count,
  (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = o.id AND t.status = 'redeemed') as redeemed_count
FROM ticketing.orders o
JOIN events.events e ON e.id = o.event_id
WHERE (
  -- Events created by user
  e.created_by = auth.uid()
  -- OR events owned by orgs where user is admin
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
AND o.status IN ('paid', 'refunded')
ORDER BY o.created_at DESC;
```

### **Query 2: Get Refund History**
```sql
-- Already available via public.refund_log view (has RLS)
SELECT * FROM public.refund_log
ORDER BY processed_at DESC;
```

---

## 🎨 **UI/UX Details**

### **Color Coding:**
- 💚 **Green:** Paid orders (refundable)
- ⚪ **Gray:** Refunded orders
- 🔴 **Red:** Orders with redeemed tickets (not refundable)
- 🟡 **Yellow:** Pending orders (payment not complete)

### **Status Badges:**
```typescript
{order.status === 'paid' && (
  <Badge variant="success">Paid</Badge>
)}
{order.status === 'refunded' && (
  <Badge variant="neutral">Refunded</Badge>
)}
{hasRedeemedTickets && (
  <Badge variant="danger">Tickets Used</Badge>
)}
```

### **Responsive Design:**
- Desktop: Full table with all columns
- Tablet: Collapse to cards, key info only
- Mobile: Stack cards, swipe for actions

---

## ⏱️ **Time Breakdown**

| Task | Component | Time |
|------|-----------|------|
| **1. Page Setup** | Create OrganizerRefundsPage.tsx | 15 min |
| **2. Orders Table** | Fetch data, display, filters | 30 min |
| **3. Refund History** | Display refund log, stats | 20 min |
| **4. Refund Modal** | Confirmation dialog, API call | 25 min |
| **5. Navigation** | Add tab to dashboard | 5 min |
| **6. Styling** | Polish, responsive | 15 min |
| **7. Testing** | User flows, edge cases | 15 min |
| **TOTAL** | | **~2 hours** |

---

## 🎯 **Success Criteria**

After implementation, organizers should be able to:

- ✅ View all orders for their events
- ✅ See refund eligibility at a glance
- ✅ Process refunds with one click
- ✅ View complete refund history
- ✅ Filter and search orders
- ✅ See why refunds are blocked (tooltips)
- ✅ Export refund reports (CSV)

---

## 🔄 **User Flow**

### **Happy Path:**
```
1. Organizer receives email: "Customer wants refund"
2. Organizer logs into Liventix → Dashboard → Refunds
3. Searches for customer email
4. Clicks "Refund" button
5. Reviews summary, adds reason
6. Clicks "Confirm Refund"
7. ✅ Toast: "Refund processing..."
8. ✅ Toast: "Refund successful! Customer will receive email."
9. Order status updates to "Refunded" in table
10. Done! (30 seconds total)
```

### **Blocked Path:**
```
1. Organizer tries to refund redeemed ticket
2. "Refund" button is grayed out
3. Hover shows: "Cannot refund - ticket already scanned"
4. Organizer contacts customer directly
```

---

## 📋 **Components to Create**

```
src/pages/new-design/
├── OrganizerRefundsPage.tsx (NEW)      - Main page container
│
src/components/organizer/
├── OrdersTable.tsx (NEW)               - Orders list with refund actions
├── RefundHistoryTable.tsx (NEW)        - Refund log display
├── RefundConfirmationModal.tsx (NEW)   - Refund confirmation dialog
└── RefundSummaryStats.tsx (NEW)        - Analytics widgets
```

---

## 🎨 **Visual Design**

### **Style Guide:**
- Follow existing dashboard design patterns
- Use shadcn/ui components (Table, Dialog, Badge, Button)
- Match current Organizer Dashboard aesthetics
- Clean, professional, minimal

### **Key Elements:**
- Status badges with color coding
- Tooltips for disabled actions
- Loading states during API calls
- Empty states ("No orders yet")
- Error states with retry buttons

---

## ⚡ **Performance Considerations**

### **Optimizations:**
- ✅ Paginated orders (10-20 per page)
- ✅ Lazy load refund history
- ✅ Debounced search (300ms)
- ✅ Cached event list
- ✅ Optimistic UI updates (mark refunded immediately, rollback on error)

### **Queries:**
- Use indexes already in place
- Limit to last 90 days by default
- Allow "View All" for complete history

---

## 🔒 **Authorization Flow**

```typescript
// Frontend checks before showing "Refund" button
const canRefund = useMemo(() => {
  // Check if user owns event
  const ownsEvent = event.created_by === user.id;
  
  // Check if user is org admin
  const isOrgAdmin = userOrgs.some(org => 
    org.id === event.owner_context_id && 
    ['admin', 'owner'].includes(org.role)
  );
  
  // Check if user is platform admin
  const isPlatformAdmin = userProfile?.is_admin;
  
  return ownsEvent || isOrgAdmin || isPlatformAdmin;
}, [event, user, userOrgs, userProfile]);

// Backend (process-refund) does the same check (never trust frontend)
```

---

## 🎯 **Implementation Plan**

### **Phase 1: Core Functionality** (~90 min)
1. Create `OrganizerRefundsPage.tsx`
2. Build `OrdersTable` component
3. Build `RefundConfirmationModal`
4. Add API integration
5. Add route and navigation

### **Phase 2: Polish** (~30 min)
6. Build `RefundHistoryTable`
7. Add summary stats
8. Add filters and search
9. Responsive styling
10. Error handling

### **Phase 3: Testing** (~15 min)
11. Test as event creator
12. Test as org admin
13. Test blocked scenarios
14. Test refund processing
15. Verify UI updates correctly

---

## ✅ **What Organizers Get**

### **Before:**
- Email from customer: "I need a refund"
- Organizer contacts Liventix support
- Liventix admin processes in Stripe Dashboard
- ⏱️ Time: Hours to days

### **After:**
- Email from customer: "I need a refund"
- Organizer logs in → Clicks "Refund"
- ✅ Done in 30 seconds
- ✅ Customer gets instant email
- ✅ Inventory automatically released

---

## 🎊 **What This Completes**

With this dashboard, Liventix will have:

✅ **Complete Purchase Flow:**
```
Browse → Add to Cart → Checkout → Payment → Tickets → Email
(100% automated)
```

✅ **Complete Refund Flow:**
```
Request → Organizer Reviews → Clicks Refund → Stripe → Database → Email
(100% automated with self-service UI)
```

---

## 📊 **Files to Create**

1. `src/pages/new-design/OrganizerRefundsPage.tsx` (NEW)
2. `src/components/organizer/OrdersTable.tsx` (NEW)
3. `src/components/organizer/RefundHistoryTable.tsx` (NEW)
4. `src/components/organizer/RefundConfirmationModal.tsx` (NEW)
5. `src/components/organizer/RefundSummaryStats.tsx` (NEW)
6. Update: `src/App.tsx` (add route)
7. Update: `src/pages/new-design/OrganizerDashboard.tsx` (add tab)

**Total:** 5 new files, 2 updates

---

## 🚀 **Approval Needed**

**This plan provides:**
- ✅ Self-service refunds for organizers
- ✅ Multi-user access (org admins can refund too)
- ✅ Complete audit trail
- ✅ Professional UI matching Eventbrite quality
- ✅ ~2 hour implementation time

**Questions before I implement:**

1. **Scope OK?** Orders table + Refund history + Confirmation modal?
2. **Location OK?** New "Refunds" tab in Organizer Dashboard?
3. **Authorization OK?** Event creators + Org admins can refund?
4. **Any additional features?** Export CSV? Bulk refunds? Refund requests queue?

**Approve this plan and I'll start building!** 🔨

