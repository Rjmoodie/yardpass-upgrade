# 🔴 Tier Revenue Display Bug - Same Issue Again!

## Problem Found

**Location:** `src/components/EventManagement.tsx` Line 1657

**Current Code:**
```typescript
<div className="font-medium">
  ${((tier.price_cents / 100) * sold).toLocaleString()}
</div>
<div className="text-xs text-muted-foreground">Revenue</div>
```

**Issue:** Calculates `revenue = price × sold` (same bug as before!)

---

## Solution

We need to fetch **actual revenue per tier** from the orders table.

**Add this to fetchTicketStats:**

```typescript
// Fetch revenue BY TIER
const { data: tierRevenue } = await supabase
  .from('order_items')
  .select(`
    tier_id,
    unit_price_cents,
    quantity,
    order:orders!inner(status)
  `)
  .eq('orders.event_id', eventId)
  .eq('orders.status', 'paid');

// Group by tier
const revenueByTier = new Map();
tierRevenue?.forEach(item => {
  const current = revenueByTier.get(item.tier_id) || 0;
  revenueByTier.set(
    item.tier_id, 
    current + (item.unit_price_cents * item.quantity)
  );
});

return revenueByTier;
```

**Then in the display:**

```typescript
<div className="font-medium">
  ${((revenueByTier.get(tier.id) || 0) / 100).toLocaleString()}
</div>
```

---

## All Revenue Display Issues

1. ✅ Top metrics - FIXED (uses actualRevenue from orders)
2. ✅ Table revenue - FIXED (uses revenue from transformed event)
3. ❌ **Tier-specific revenue** - STILL BROKEN (calculates price × sold)

This is why you see 3 different numbers!

