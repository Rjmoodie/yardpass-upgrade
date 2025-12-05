# 🔍 Comprehensive Analytics Audit - All Calculations

**Goal:** Ensure EVERY metric dynamically uses actual database data  
**No hardcoded assumptions, no calculated revenue**

---

## 📊 ALL METRICS TO VERIFY

### **EventManagement.tsx Top Cards:**

| Metric | Current Source | Should Be | Status |
|--------|----------------|-----------|--------|
| Tickets Sold | `SUM(editableTiers.issued_quantity)` | `COUNT(tickets)` | ⚠️ Check |
| Total Attendees | `COUNT(attendees)` | `COUNT(tickets)` | ⚠️ Check |
| Net Revenue | `ticketStats.actualRevenue` | `SUM(orders.subtotal_cents)` | ✅ |
| Checked In | `COUNT(attendees WHERE checkedIn)` | `COUNT(scan_logs)` | ⚠️ Check |
| Avg Price | `ticketStats.averagePrice` | `revenue / tickets` | ⚠️ Check |
| Refund Rate | `ticketStats.refundRate` | `refunds / revenue` | ✅ |

### **EventManagement.tsx Tier Cards:**

| Metric | Current Source | Should Be | Status |
|--------|----------------|-----------|--------|
| Tier Name | `tier.name` | DB field | ✅ |
| Price | `tier.price_cents / 100` | DB field | ✅ |
| Sold Count | `tier.issued_quantity` | DB field | ✅ |
| Total Capacity | `tier.quantity` | DB field | ✅ |
| Available | `quantity - reserved - issued` | Calculated | ✅ |
| Tier Revenue | `revenueByTier.get(tier.id)` | `SUM(order_items WHERE tier_id)` | ✅ |

### **OrganizerDashboard.tsx:**

| Metric | Current Source | Should Be | Status |
|--------|----------------|-----------|--------|
| Revenue per event | `SUM(orders.subtotal_cents)` | Same | ✅ |
| Tickets per event | `COUNT(tickets)` | Same | ✅ |
| Total revenue | `SUM(event.revenue)` | Aggregated | ✅ |
| Total attendees | `SUM(event.attendees)` | Aggregated | ✅ |

---

## 🔍 Issues Found

### **Issue 1: Tickets Sold vs Total Attendees**

**Line 448-460 in EventManagement.tsx:**
```typescript
const { totalTickets, soldTickets, revenue } = useMemo(() => {
  const totals = editableTiers.reduce((acc, tier) => {
    const sold = tier.issued_quantity || 0;  // From DB ✅
    acc.totalTickets += tier.quantity || 0;
    acc.soldTickets += sold;
    return acc;
  }, { totalTickets: 0, soldTickets: 0, revenue: 0 });

  return {
    ...totals,
    revenue: actualRevenue,
    totalAttendees: attendees.length,  // ⚠️ Different source!
    checkedInCount: checkedIn,
  };
}, [attendees, editableTiers, ticketStats]);
```

**Problem:**
- `soldTickets` = `SUM(tier.issued_quantity)` from ticket_tiers
- `totalAttendees` = `COUNT(attendees)` from separate query

**These should be the SAME number** (both = COUNT(tickets))!

**Fix:** Use same source for both.

---

### **Issue 2: Missing revenueByTier in dependencies**

**Line 472 useMemo dependencies:**
```typescript
}, [attendees, editableTiers, ticketStats]);
```

**Missing:** `revenueByTier`

**Fix:** Add to dependencies:
```typescript
}, [attendees, editableTiers, ticketStats, revenueByTier]);
```

---

### **Issue 3: Avg Price calculation**

**Current:** Uses `averagePrice` from ticketStats  
**Calculated as:** `totalRevenue / paidOrders.length`

**Issue:** This is average per ORDER, not per TICKET

**Should be:**
- Avg per ticket: `totalRevenue / totalTickets`
- Avg per order: `totalRevenue / paidOrders`

**Which one to show?** Depends on use case.

---

## ✅ FIXES TO APPLY

### **Fix 1: Use tickets count consistently**

```typescript
// Fetch tickets once, use everywhere
const ticketsData = await supabase
  .from('tickets')
  .select('id, status, tier_id')
  .eq('event_id', eventId);

const totalTickets = ticketsData?.length || 0;
const ticketsByTier = new Map();
ticketsData?.forEach(t => {
  ticketsByTier.set(t.tier_id, (ticketsByTier.get(t.tier_id) || 0) + 1);
});

// Use this for BOTH soldTickets and totalAttendees
```

---

### **Fix 2: Add revenueByTier to useMemo**

```typescript
const { totalTickets, soldTickets, revenue } = useMemo(() => {
  // ... calculations
}, [attendees, editableTiers, ticketStats, revenueByTier]); // ✅ Added
```

---

### **Fix 3: Calculate avg price correctly**

```typescript
// In fetchTicketStats
const totalTickets = (await supabase
  .from('tickets')
  .select('id', { count: 'exact' })
  .eq('event_id', eventId)
  .in('order_id', paidOrders.map(o => o.id))
).count || 0;

const avgPricePerTicket = totalTickets > 0 ? netRevenue / totalTickets : 0;
const avgPricePerOrder = paidOrders.length > 0 ? netRevenue / paidOrders.length : 0;
```

---

## 🧪 Verification Query

Run this for ANY event to verify all numbers:

```sql
WITH event_data AS (
  SELECT 
    '28309929-28e7-4bda-af28-6e0b47485ce1'::uuid as event_id
)
SELECT 
  -- From orders table
  (SELECT COUNT(*) FROM ticketing.orders o, event_data e 
   WHERE o.event_id = e.event_id AND o.status = 'paid') as paid_orders,
  (SELECT SUM(subtotal_cents) / 100.0 FROM ticketing.orders o, event_data e 
   WHERE o.event_id = e.event_id AND o.status = 'paid') as net_revenue_from_orders,
  
  -- From tickets table
  (SELECT COUNT(*) FROM ticketing.tickets t, event_data e 
   WHERE t.event_id = e.event_id) as tickets_issued,
  
  -- From ticket_tiers
  (SELECT SUM(issued_quantity) FROM ticketing.ticket_tiers tt, event_data e 
   WHERE tt.event_id = e.event_id) as issued_qty_counter,
  
  -- From order_items
  (SELECT SUM(unit_price_cents * quantity) / 100.0 
   FROM ticketing.order_items oi
   JOIN ticketing.orders o ON o.id = oi.order_id, event_data e
   WHERE o.event_id = e.event_id AND o.status = 'paid') as revenue_from_order_items,
  
  -- Verification
  CASE 
    WHEN (SELECT COUNT(*) FROM ticketing.tickets t, event_data e WHERE t.event_id = e.event_id) = 
         (SELECT SUM(issued_quantity) FROM ticketing.ticket_tiers tt, event_data e WHERE tt.event_id = e.event_id)
    THEN '✅ Tickets = issued_qty'
    ELSE '❌ MISMATCH'
  END as tickets_match;
```

**All these numbers should match:**
- `net_revenue_from_orders` = `revenue_from_order_items`
- `tickets_issued` = `issued_qty_counter`

---

## 🎯 Action Plan

1. ✅ Fix tier revenue (DONE)
2. ⏳ Add revenueByTier to dependencies
3. ⏳ Ensure tickets count is consistent
4. ⏳ Fix avg price calculation
5. ⏳ Add comprehensive error handling

Implementing now...

