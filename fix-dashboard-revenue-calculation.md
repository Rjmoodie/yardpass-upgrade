# 🔴 Dashboard Revenue Bug - Fix Required

## Problem Found

**Location:** `src/components/EventManagement.tsx` line 438

**Current Code (WRONG):**
```typescript
const { totalTickets, soldTickets, revenue } = useMemo(() => {
  const totals = ticketTiers.reduce(
    (acc, tier) => {
      const sold = tier.total - tier.available;  // ❌ Calculated from capacity
      acc.soldTickets += sold;
      acc.revenue += tier.price * sold;  // ❌ WRONG! Doesn't use actual orders
      return acc;
    },
    { totalTickets: 0, soldTickets: 0, revenue: 0 }
  );
}, [ticketTiers]);
```

**Problem:**
- Calculates: `revenue = ticket_price × (total - available)`
- But this doesn't account for:
  - Actual order amounts
  - Different customers paying different amounts
  - Orders that failed to create tickets
  - Partial refunds

**Result:** Shows $456.32 instead of actual $600.00 ($143.68 error!)

---

## Correct Calculation

**Should query actual orders table:**

```typescript
const { totalTickets, soldTickets, revenue } = useMemo(() => {
  // ✅ Get actual tickets count
  const tickets = attendees.length;  // From tickets table
  
  // ✅ Calculate revenue from actual paid orders (NOT from price × count)
  // This should come from a query to orders table
  const actualRevenue = 0;  // Need to fetch from orders
  
  return {
    totalTickets: ticketTiers.reduce((sum, t) => sum + t.total, 0),
    soldTickets: tickets,
    revenue: actualRevenue,
    totalAttendees: tickets,
    checkedInCount: attendees.filter(a => a.checkedIn).length
  };
}, [attendees, ticketTiers]);
```

---

## Fix Required

### Location 1: Fetch actual revenue when loading event

```typescript
// In fetchTicketStats or similar function
const { data: revenueData } = await supabase
  .from('orders')
  .select('subtotal_cents')
  .eq('event_id', eventId)
  .eq('status', 'paid');

const actualRevenue = (revenueData || [])
  .reduce((sum, o) => sum + (o.subtotal_cents || 0), 0) / 100;
```

### Location 2: Update the useMemo calculation

```typescript
const { soldTickets, revenue } = useMemo(() => {
  return {
    totalTickets: ticketTiers.reduce((sum, t) => sum + t.total, 0),
    soldTickets: attendees.length,  // ✅ From actual tickets table
    revenue: actualRevenueFromOrders,  // ✅ From orders query (not calculated)
    totalAttendees: attendees.length,
    checkedInCount: attendees.filter(a => a.checkedIn).length
  };
}, [attendees, ticketTiers, actualRevenueFromOrders]);
```

---

## Why This Matters

**Current Issue:**
- Dashboard shows $456.32
- Database has $600.00  
- **Organizers see wrong revenue** (underreported by 24%)

**Impact:**
- Financial reporting incorrect
- Tax implications
- Business decisions based on wrong data
- Loss of trust

---

## Should We Fix Now?

**Option A:** Fix dashboard revenue calculation (1-2 hours)
- Find EventManagement component
- Add orders query for revenue
- Update calculation
- Test

**Option B:** Document as known issue, fix later
- Add to technical debt
- Fix in next sprint

**Recommendation:** Fix now (1-2 hours) - revenue accuracy is critical

What would you like to do?

