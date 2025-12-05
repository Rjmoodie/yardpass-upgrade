# 🔍 Analytics Consistency Audit - All Components

**Date:** December 4, 2025  
**Purpose:** Ensure all analytics calculations match database source of truth  
**Database Verified:** ✅ Accurate after reconciliation

---

## 📊 Analytics Components Found

| Component | Location | Status | Issue |
|-----------|----------|--------|-------|
| EventManagement | `src/components/EventManagement.tsx:438` | ✅ FIXED | Was calculating from price×sold, now uses orders |
| OrganizerDashboard | `src/components/OrganizerDashboard.tsx:359` | ✅ CORRECT | Uses `total_cents` from orders |
| AnalyticsHub | `src/components/AnalyticsHub.tsx:1120` | ⚠️ NEEDS CHECK | Uses `total_cents` (gross) - should be subtotal? |
| useOrganizerAnalytics.tsx | `src/hooks/useOrganizerAnalytics.tsx:126` | ❌ **BROKEN** | Calculates from `price_cents`, not orders! |
| useOrganizerAnalytics.ts | `src/hooks/useOrganizerAnalytics.ts:169` | ✅ CORRECT | Uses `total_cents` from orders |

---

## 🔴 CRITICAL ISSUE FOUND

### **useOrganizerAnalytics.tsx (Line 126)**

**Current Code (WRONG):**
```typescript
ticketData?.forEach(ticket => {
  const analytics = analyticsMap.get(ticket.event_id);
  if (analytics) {
    analytics.total_attendees++;
    if (ticket.status === 'issued') {
      analytics.ticket_sales++;
      analytics.total_revenue += (ticket.ticket_tiers as any)?.price_cents || 0;  // ❌ WRONG!
    }
  }
});
```

**Problem:**
- Calculates revenue by adding tier price for each ticket
- Doesn't use actual order amounts
- Same bug as EventManagement had!

**Impact:**
- Analytics showing wrong revenue
- May match dashboard now, but both were wrong
- After EventManagement fix, analytics will be inconsistent

---

## ✅ CORRECT PATTERN

### **What ALL analytics should use:**

```typescript
// ✅ CORRECT: Query orders table
const { data: orders } = await supabase
  .from('orders')
  .select('id, total_cents, subtotal_cents, status')
  .eq('event_id', eventId);

const paidOrders = orders?.filter(o => o.status === 'paid') || [];

// For organizer views (what they receive):
const netRevenue = paidOrders.reduce(
  (sum, o) => sum + (o.subtotal_cents || 0), 
  0
) / 100;

// For platform analytics (total transacted):
const grossRevenue = paidOrders.reduce(
  (sum, o) => sum + (o.total_cents || 0), 
  0
) / 100;
```

---

## 📋 Required Fixes

### **Fix 1: useOrganizerAnalytics.tsx** ❌ CRITICAL

**Current:** Line 126 calculates from ticket price  
**Fix:** Query orders table instead

**Steps:**
1. Add orders to the query (line 50-60)
2. Process orders for revenue (not tickets)
3. Keep tickets for attendee count only

---

### **Fix 2: AnalyticsHub.tsx** ⚠️ VERIFY

**Current:** Line 1120 uses `total_cents` (gross)  
**Decision Needed:** Should organizers see gross or net?

**Options:**
- **A: Show Net (subtotal_cents)** - What organizer receives
- **B: Show Gross (total_cents)** - Total customer paid

**Recommendation:** Show Net (subtotal_cents) for consistency

---

### **Fix 3: Add subtotal_cents to queries**

**Files to update:**
1. ✅ EventManagement.tsx - DONE
2. ⏳ useOrganizerAnalytics.tsx - NEEDS FIX
3. ⏳ AnalyticsHub.tsx - NEEDS UPDATE
4. ✅ OrganizerDashboard.tsx - Already uses orders correctly

---

## 🎯 Decision Matrix

### **Revenue Display Strategy:**

| View | Metric | Field | Reason |
|------|--------|-------|--------|
| **Organizer Dashboard** | Net Revenue | `subtotal_cents` | What they receive |
| **Event Management** | Net Revenue | `subtotal_cents` | What they receive |
| **Platform Analytics** | Gross Revenue | `total_cents` | Total transacted |
| **Financial Reports** | Both | Both | Full breakdown |

**Recommendation:** 
- Organizer-facing views → Use `subtotal_cents` (net)
- Platform/admin views → Use `total_cents` (gross)
- Always label clearly: "Net Revenue" vs "Gross Revenue"

---

## 🔧 Implementation Priority

### **P0 - Fix Now (Critical Accuracy Issues):**
1. ✅ EventManagement.tsx - FIXED
2. ❌ **useOrganizerAnalytics.tsx** - BROKEN (calculates from price)

### **P1 - Update Soon (Consistency):**
3. ⚠️ AnalyticsHub.tsx - Works but may show wrong value (gross vs net)
4. ⚠️ Add clear labels: "Net" vs "Gross"

### **P2 - Enhancement:**
5. Add revenue breakdown (subtotal, fees, total) in detailed views
6. Reconciliation report in admin panel

---

## 📊 Testing Checklist

After fixes, verify:

**Liventix Official Event:**
- [ ] EventManagement shows: $600.00 ✅
- [ ] OrganizerDashboard shows: $600.00 (net) or $682.34 (gross)
- [ ] AnalyticsHub shows: $600.00 (net) or $682.34 (gross)
- [ ] useOrganizerAnalytics shows: $600.00 (net) or $682.34 (gross)

**Database Query:**
```sql
SELECT 
  SUM(subtotal_cents) / 100.0 as net_revenue,
  SUM(total_cents) / 100.0 as gross_revenue,
  SUM(fees_cents) / 100.0 as platform_fees
FROM ticketing.orders
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
  AND status = 'paid';
```

**Expected:**
- net_revenue: $600.00
- gross_revenue: $682.34
- platform_fees: $82.34

---

## ✅ Quick Fix Summary

### **File 1: useOrganizerAnalytics.tsx**

**REMOVE this (lines 119-129):**
```typescript
// Process ticket data
ticketData?.forEach(ticket => {
  const analytics = analyticsMap.get(ticket.event_id);
  if (analytics) {
    analytics.total_attendees++;
    if (ticket.status === 'issued') {
      analytics.ticket_sales++;
      analytics.total_revenue += (ticket.ticket_tiers as any)?.price_cents || 0;  // ❌
    }
  }
});
```

**ADD orders query and process:**
```typescript
// Query orders for revenue
const { data: ordersData } = await supabase
  .from('orders')
  .select('event_id, status, subtotal_cents, total_cents')
  .in('event_id', eventIds)
  .eq('status', 'paid');

// Process orders for revenue
ordersData?.forEach(order => {
  const analytics = analyticsMap.get(order.event_id);
  if (analytics) {
    analytics.total_revenue += (order.subtotal_cents || 0) / 100;  // ✅ Net revenue
  }
});

// Process ticket data (for attendees only, not revenue)
ticketData?.forEach(ticket => {
  const analytics = analyticsMap.get(ticket.event_id);
  if (analytics) {
    analytics.total_attendees++;
    if (ticket.status === 'issued') {
      analytics.ticket_sales++;
      // ✅ NO REVENUE CALCULATION HERE
    }
  }
});
```

---

## 🎯 Final State

**After all fixes:**

✅ **Single Source of Truth:** All revenue from `orders` table  
✅ **Consistent:** All components show same numbers  
✅ **Accurate:** Matches database reconciliation  
✅ **Clear:** Labeled as "Net" or "Gross"  
✅ **Tested:** Verified against known good data

---

## 📞 Action Items

**Immediate (Now):**
- [ ] Fix useOrganizerAnalytics.tsx (use orders, not ticket prices)
- [ ] Decide: Net vs Gross for each view
- [ ] Update AnalyticsHub.tsx to use subtotal_cents if showing to organizers

**This Session:**
- [ ] Test all analytics show $600.00 for Liventix event
- [ ] Verify consistency across all views
- [ ] Deploy fixes

**Next Sprint:**
- [ ] Add revenue breakdown views
- [ ] Add clear labels everywhere
- [ ] Admin reconciliation dashboard

---

**Priority:** 🔴 **HIGH** - Revenue accuracy is critical for organizers

