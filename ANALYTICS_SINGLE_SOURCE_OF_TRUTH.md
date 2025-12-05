# ✅ Analytics - Single Source of Truth Implementation

**Date:** December 4, 2025  
**Philosophy:** One canonical source per concept, everything else derived

---

## 🎯 Canonical Sources Defined

### **1. Tickets Sold / Attendees**
**Authority:** `ticketing.tickets` table  
**Query:** `COUNT(tickets WHERE status IN ('issued', 'transferred', 'redeemed'))`  
**NOT:** `ticket_tiers.issued_quantity` (counter can drift)

**Usage:**
- Tickets Sold: COUNT(tickets)
- Total Attendees: COUNT(tickets) 
- Active Tickets: COUNT(tickets WHERE status != 'refunded')

---

### **2. Revenue**
**Authority:** `ticketing.orders` table  
**Query:** `SUM(orders.subtotal_cents WHERE status = 'paid')`  
**NOT:** `price × sold` (assumptions fail)

**Per-Tier Revenue:**
**Authority:** `ticketing.order_items` table  
**Query:** `SUM(order_items.unit_price_cents × quantity)` grouped by tier_id

---

### **3. Check-Ins**
**Authority:** `ticketing.tickets` table (status = 'redeemed')  
**Alternative:** `COUNT(DISTINCT scan_logs.ticket_id WHERE result = 'valid')`  
**NOT:** `COUNT(scan_logs)` (can have duplicates)

**Recommendation:** Use `tickets.redeemed_at IS NOT NULL`

---

### **4. Capacity**
**Authority:** `ticketing.ticket_tiers` table  
**Fields:** `quantity`, `reserved_quantity`, `issued_quantity`  
**Available:** `quantity - reserved_quantity - issued_quantity`

---

### **5. Average Pricing**
**Two distinct metrics:**

**Avg Price Per Ticket:**
```sql
SUM(orders.subtotal_cents WHERE status='paid') / COUNT(tickets)
```

**Avg Order Value (AOV):**
```sql
SUM(orders.subtotal_cents WHERE status='paid') / COUNT(orders WHERE status='paid')
```

**Label clearly in UI!**

---

## 🔧 Implementation

### **EventManagement.tsx - Comprehensive Fix**

```typescript
// State for all metrics
const [eventMetrics, setEventMetrics] = useState({
  // From orders
  paidOrders: 0,
  netRevenue: 0,
  grossRevenue: 0,
  
  // From tickets
  ticketsIssued: 0,
  ticketsActive: 0,
  ticketsRedeemed: 0,
  
  // Per-tier revenue (Map: tier_id -> revenue_cents)
  revenueByTier: new Map<string, number>(),
  
  // Calculated
  avgPricePerTicket: 0,
  avgOrderValue: 0,
  refundRate: 0
});

// Single comprehensive fetch
const fetchEventMetrics = useCallback(async () => {
  if (!eventId) return;
  
  try {
    // Parallel fetch all data sources
    const [
      { data: orders },
      { data: tickets },
      { data: orderItems },
      { data: refunds }
    ] = await Promise.all([
      supabase.from('orders')
        .select('id, status, subtotal_cents, total_cents')
        .eq('event_id', eventId),
      supabase.from('tickets')
        .select('id, status, tier_id, redeemed_at')
        .eq('event_id', eventId),
      supabase.from('order_items')
        .select('tier_id, unit_price_cents, quantity, order_id')
        .in('order_id', (orders || []).filter(o => o.status === 'paid').map(o => o.id)),
      supabase.from('refunds')
        .select('amount_cents, order_id')
        .in('order_id', (orders || []).map(o => o.id))
    ]);
    
    // Calculate from actual data
    const paidOrders = orders?.filter(o => o.status === 'paid') || [];
    const netRevenue = paidOrders.reduce((sum, o) => sum + (o.subtotal_cents || 0), 0);
    const grossRevenue = paidOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0);
    
    const activeTickets = tickets?.filter(t => 
      ['issued', 'transferred', 'redeemed'].includes(t.status)
    ) || [];
    
    const redeemedTickets = tickets?.filter(t => t.status === 'redeemed') || [];
    
    // Revenue by tier
    const tierRevMap = new Map<string, number>();
    orderItems?.forEach(item => {
      const current = tierRevMap.get(item.tier_id) || 0;
      tierRevMap.set(item.tier_id, current + (item.unit_price_cents * item.quantity));
    });
    
    const totalRefunds = refunds?.reduce((sum, r) => sum + r.amount_cents, 0) || 0;
    
    // Set all metrics at once
    setEventMetrics({
      paidOrders: paidOrders.length,
      netRevenue: (netRevenue - totalRefunds) / 100,
      grossRevenue: (grossRevenue - totalRefunds) / 100,
      ticketsIssued: tickets?.length || 0,
      ticketsActive: activeTickets.length,
      ticketsRedeemed: redeemedTickets.length,
      revenueByTier: tierRevMap,
      avgPricePerTicket: activeTickets.length > 0 ? netRevenue / activeTickets.length / 100 : 0,
      avgOrderValue: paidOrders.length > 0 ? netRevenue / paidOrders.length / 100 : 0,
      refundRate: grossRevenue > 0 ? (totalRefunds / grossRevenue) * 100 : 0
    });
    
  } catch (error) {
    console.error('Error fetching event metrics:', error);
    // Set safe defaults on error
    setEventMetrics({
      paidOrders: 0,
      netRevenue: 0,
      grossRevenue: 0,
      ticketsIssued: 0,
      ticketsActive: 0,
      ticketsRedeemed: 0,
      revenueByTier: new Map(),
      avgPricePerTicket: 0,
      avgOrderValue: 0,
      refundRate: 0
    });
  }
}, [eventId]);
```

---

## 📊 Display Metrics (All from eventMetrics state)

```typescript
// Top cards
<Card>
  <div>{eventMetrics.ticketsActive}</div>  {/* ✅ From tickets table */}
  <div>Tickets Sold</div>
</Card>

<Card>
  <div>{eventMetrics.ticketsActive}</div>  {/* ✅ Same as tickets */}
  <div>Total Attendees</div>
</Card>

<Card>
  <div>${eventMetrics.netRevenue.toFixed(2)}</div>  {/* ✅ From orders */}
  <div>Net Revenue</div>
</Card>

<Card>
  <div>{eventMetrics.ticketsRedeemed}</div>  {/* ✅ From tickets.status */}
  <div>Checked In</div>
</Card>

<Card>
  <div>${eventMetrics.avgPricePerTicket.toFixed(2)}</div>  {/* ✅ Calculated */}
  <div>Avg Ticket Price</div>  {/* ✅ Clear label */}
</Card>

// Per-tier revenue
{editableTiers.map(tier => (
  <div>
    ${(eventMetrics.revenueByTier.get(tier.id) || 0) / 100}  {/* ✅ From order_items */}
    <div>Revenue</div>
  </div>
))}
```

---

## 🎯 Benefits of This Approach

### **Single Fetch:**
- ✅ All data fetched once in parallel
- ✅ No N+1 queries
- ✅ Consistent snapshot of data

### **Single State:**
- ✅ All metrics in one object
- ✅ Updated atomically
- ✅ Easy to test

### **Clear Dependencies:**
- ✅ useMemo depends on eventMetrics
- ✅ No hidden dependencies
- ✅ React can optimize properly

### **Error Handling:**
- ✅ One try/catch for all data
- ✅ Safe defaults on error
- ✅ User sees "0" not crashes

---

## 🚀 Future: SQL View/RPC

**Create once, use everywhere:**

```sql
CREATE OR REPLACE FUNCTION ticketing.get_event_stats(p_event_id UUID)
RETURNS TABLE (
  paid_orders INTEGER,
  net_revenue_cents BIGINT,
  gross_revenue_cents BIGINT,
  tickets_issued INTEGER,
  tickets_active INTEGER,
  tickets_redeemed INTEGER,
  avg_price_per_ticket_cents INTEGER,
  avg_order_value_cents INTEGER,
  refund_rate_pct NUMERIC,
  tier_stats JSONB  -- Array of {tier_id, tier_name, revenue_cents, tickets}
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH ... (your verification SQL here)
  SELECT ...;
END;
$$;
```

**Then in frontend:**
```typescript
const { data } = await supabase.rpc('get_event_stats', { p_event_id: eventId });
setEventMetrics(data);
```

**Benefits:**
- ✅ Logic in ONE place (database)
- ✅ Tested once, works everywhere
- ✅ Performance (single query)
- ✅ Consistent across ALL UI components

---

## 📋 Implementation Checklist

### **Immediate (This Session):**
- [x] Fix tier revenue display (use order_items)
- [x] Add revenueByTier to dependencies
- [ ] Consolidate metrics into single state
- [ ] Single parallel fetch function
- [ ] Clear avg price labeling
- [ ] Error handling with safe defaults

### **Next Sprint:**
- [ ] Create `get_event_stats` RPC
- [ ] Use RPC in all components
- [ ] Deprecate individual queries
- [ ] Add to documentation

---

## ✅ Status

**Current:** Fixes applied, needs consolidation  
**Next:** Implement single fetch pattern  
**Future:** Move to RPC for all components

Should I implement the consolidated fetch pattern now?

