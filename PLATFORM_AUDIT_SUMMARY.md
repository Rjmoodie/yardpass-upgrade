# 🔍 Platform-Wide Ticket Accounting Audit - December 4, 2025

## 🎯 Executive Summary

**Status:** 🔴 **ACTION REQUIRED**

**Key Findings:**
- 🔴 **190 tickets hidden** by ghost reservations platform-wide
- 🔴 **12 paid orders missing tickets** (estimated $300-600 revenue impact)
- 🔴 **1 event with negative availability** (data corruption)
- 🟡 **3 events with ghost reservations** affecting sales

**Estimated Revenue at Risk:** ~$500-800

---

## 📊 Platform Metrics

| Metric | Value | Status |
|--------|-------|--------|
| **Total Events** | 16 | ✅ |
| **Events with Tickets** | 13 | ✅ |
| **Total Capacity** | 2,148 tickets | ✅ |
| **Tickets Issued** | 204 | ✅ |
| **Total Revenue** | $17,747.66 | ✅ |
| **Ghost Reservations** | **190** | 🔴 |
| **Paid Orders Missing Tickets** | **12** | 🔴 |

**Utilization:** 9.5% of capacity sold (204 / 2148)

---

## 🔴 **P1 Critical Issues (Fix Immediately)**

### **1. Splish and Splash** 
**Event ID:** `d98755ff-6996-4b8e-85b1-25e9323dd2ee`

**Problems:**
- ❌ **VIP Tier: -1 available** (22 issued, 21 capacity) - OVER-SOLD!
- 🟡 GA: 34 ghost reservations
- ❌ 1 paid order missing tickets

**Impact:** Organizer sold 1 more VIP ticket than exists

**Fix Required:**
```sql
-- Option A: Increase VIP capacity to 22 (if legitimate)
UPDATE ticketing.ticket_tiers
SET quantity = 22
WHERE event_id = 'd98755ff-6996-4b8e-85b1-25e9323dd2ee' AND name = 'VIP';

-- Option B: Investigate which ticket to void
-- See fix-splish-splash-critical.sql for details
```

---

### **2. Ultimate Soccer Tailgate**
**Event ID:** `45691a09-f1a9-4ab1-9e2f-e4e40e692960`

**Problems:**
- ❌ **6 paid orders with no tickets!** (HIGHEST ON PLATFORM)
- 🟡 94 ghost reservations (70 GA + 24 Free)

**Revenue Impact:** $300-600 in missing tickets

**Fix Required:**
1. Clear ghost reservations
2. Create tickets for 6 paid orders

---

### **3. Liventix Official Event**
**Event ID:** `28309929-28e7-4bda-af28-6e0b47485ce1`

**Status:** ✅ **Ghost reservations FIXED!**

**Remaining:**
- ❌ 2 paid orders missing tickets

---

### **4. Summer Music Festival 2024**
**Event ID:** `4f550d2f-c810-4268-90e0-4b632341b036`

**Problems:**
- 🟡 62 ghost reservations (34 GA + 28 VIP)
- ❌ 3 paid orders missing tickets

---

## 🚀 **Immediate Action Plan**

### **Step 1: Clear ALL Ghost Reservations (5 minutes)**

**File:** `fix-all-ghost-reservations.sql`

**Run this to free all 190 hidden tickets:**

```sql
UPDATE ticketing.ticket_tiers tt
SET reserved_quantity = COALESCE((
  SELECT SUM(th.quantity)
  FROM ticketing.ticket_holds th
  WHERE th.tier_id = tt.id
    AND th.status = 'active'
    AND th.expires_at > NOW()
), 0)
WHERE tt.reserved_quantity != COALESCE((
  SELECT SUM(th.quantity)
  FROM ticketing.ticket_holds th
  WHERE th.tier_id = tt.id
    AND th.status = 'active'
    AND th.expires_at > NOW()
), 0);
```

**Expected:** 190 tickets freed across 4 events

---

### **Step 2: Fix Splish and Splash VIP Over-Issue (Critical!)**

**Decide:**
- **Option A:** Increase capacity 21 → 22 (accept the extra ticket)
- **Option B:** Refund/void 1 VIP ticket

**See:** `fix-splish-splash-critical.sql` for detailed investigation

---

### **Step 3: Create Missing Tickets (12 orders)**

For each event with missing tickets, you need to:

**Events affected:**
- Ultimate Soccer Tailgate: 6 orders
- Summer Music Festival: 3 orders  
- Liventix Official Event: 2 orders
- Splish and Splash: 1 order

**Query to find order IDs:**

```sql
-- Get list of all orders needing tickets
SELECT 
  e.title as event_title,
  o.id as order_id,
  o.user_id,
  o.total_cents / 100.0 as amount_paid,
  o.created_at,
  (SELECT jsonb_agg(
    jsonb_build_object(
      'tier_id', oi.tier_id,
      'quantity', oi.quantity,
      'tier_name', (SELECT name FROM ticketing.ticket_tiers WHERE id = oi.tier_id)
    )
   )
   FROM ticketing.order_items oi
   WHERE oi.order_id = o.id) as items_ordered
FROM ticketing.orders o
JOIN events.events e ON e.id = o.event_id
WHERE o.status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM ticketing.tickets t WHERE t.order_id = o.id)
  AND o.event_id IN (
    'd98755ff-6996-4b8e-85b1-25e9323dd2ee',  -- Splish and Splash
    '45691a09-f1a9-4ab1-9e2f-e4e40e692960',  -- Ultimate Soccer Tailgate
    '28309929-28e7-4bda-af28-6e0b47485ce1',  -- Liventix Official
    '4f550d2f-c810-4268-90e0-4b632341b036'   -- Summer Music Festival
  )
ORDER BY e.title, o.created_at;
```

**Then for each order_id, call:**
```
POST to: /functions/v1/ensure-tickets
Body: { "order_id": "ORDER_ID_FROM_ABOVE" }
```

---

## 📋 **Detailed Breakdown by Event**

### **Events Needing Ghost Reservation Cleanup:**

| Event | Tier | Ghost Reserved | Tickets Hidden |
|-------|------|----------------|----------------|
| Ultimate Soccer Tailgate | GA | 70 | 70 |
| Ultimate Soccer Tailgate | Free | 24 | 24 |
| Summer Music Festival | GA | 34 | 34 |
| Summer Music Festival | VIP | 28 | 28 |
| Splish and Splash | GA | 34 | 34 |
| **TOTAL** | - | **190** | **190** |

### **Events Needing Ticket Creation:**

| Event | Orders Missing Tickets | Est. Revenue |
|-------|------------------------|--------------|
| Ultimate Soccer Tailgate | 6 | $300-600 |
| Summer Music Festival | 3 | $150-300 |
| Liventix Official | 2 | $100-150 |
| Splish and Splash | 1 | $50-100 |
| **TOTAL** | **12** | **$600-1150** |

---

## 🎯 **Priority Order:**

1. **🔴 CRITICAL:** Fix Splish and Splash VIP negative availability
2. **🔴 HIGH:** Clear 190 ghost reservations (run bulk fix)
3. **🟠 MEDIUM:** Create 12 missing tickets
4. **🟡 LOW:** Clean up stale pending orders (optional)

---

## ✅ **Success Metrics**

After fixes:
- [ ] `platform_wide_ghost_reservations = 0`
- [ ] `paid_orders_no_tickets = 0` for all events
- [ ] No tiers with negative availability
- [ ] `health_score = 0` for all events

---

## 📞 **Recommended Actions**

### **Immediate (Next 30 minutes):**
1. Run `fix-all-ghost-reservations.sql` → Frees 190 tickets
2. Run `fix-splish-splash-critical.sql` → Fix VIP over-issue

### **Within 24 hours:**
1. Create missing tickets for 12 paid orders
2. Verify all events show `health_score = 0`

### **Within 1 week:**
1. Enable automated cleanup cron jobs
2. Set up monitoring alerts
3. Add constraints to prevent future corruption

---

**Status:** 🔴 Multiple critical issues found  
**Next Step:** Run `fix-all-ghost-reservations.sql` to free 190 tickets  
**Est. Time to Fix All:** 1-2 hours

