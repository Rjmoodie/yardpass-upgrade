# 🎫 Real Event Test Data Reference

## Quick Reference for Testing

Use this data when testing your checkout system with real events and tiers from your database.

---

## Event 1: Liventix Launch

**Tier:** General Admission  
**Price:** $10.00 ($0.10 in cents)  
**Tier ID:** `a496a470-0f96-4ee6-aa3e-5d6628623686`  
**Available:** 100 tickets  
**Max Per Order:** 6  
**Badge:** GA

**Test Scenario:** Single ticket, low-price point, good for basic checkout testing

---

## Event 2: Yard Pass Official Private Launch

**Tier:** Private Launch  
**Price:** $10.00  
**Tier ID:** `fb9fd256-6c9e-4650-993a-7980cebbb851`  
**Available:** 92 tickets  
**Max Per Order:** 6  
**Badge:** VIP Launcher

**Test Scenario:** Similar pricing to Event 1, test VIP badge display

---

## Event 3: Summer Music Festival 2024

### Tier 1: General Admission
**Price:** $50.00  
**Tier ID:** `0f7136fe-d3a0-49e9-a2fa-b2b84e27674c`  
**Available:** 500 tickets  
**Max Per Order:** 6  
**Badge:** GENERAL

### Tier 2: VIP
**Price:** $150.00  
**Tier ID:** `cb51f823-932d-4ded-a93c-8685776e1e64`  
**Available:** 100 tickets  
**Max Per Order:** 4  
**Badge:** VIP

**Test Scenario:** Multi-tier event, good for testing mixed cart (GA + VIP)

---

## Event 4: Splish and Splash

### Tier 1: General Admission
**Price:** $30.00  
**Tier ID:** `0ef5e2ba-b7ca-4722-8ac7-8fe00355a2f5`  
**Available:** 81 tickets  
**Max Per Order:** 6  
**Badge:** GA

### Tier 2: VIP
**Price:** $90.00  
**Tier ID:** `fb4aa5a7-05a9-42da-b444-65ea7bf8a6b1`  
**Available:** 21 tickets  
**Max Per Order:** 6  
**Badge:** VIP

**Test Scenario:** Mid-range pricing, good for testing quantity limits and fees

---

## 📋 Test Combinations

### Simple Tests (Single Tier)
```
1. Liventix Launch - 1x GA ($10)
2. Liventix Launch - 6x GA ($60) [max per order]
3. Summer Festival - 2x GA ($100)
```

### Complex Tests (Multiple Tiers)
```
1. Summer Festival - 2x GA + 1x VIP ($250)
2. Splish and Splash - 3x GA + 2x VIP ($270)
3. Splish and Splash - 6x GA + 4x VIP ($540) [max quantities]
```

### Edge Cases
```
1. Max per order limit (6x or 4x depending on tier)
2. Low inventory (VIP Splish has only 21 left)
3. Different price points ($10, $30, $50, $90, $150)
```

---

## 💰 Expected Fee Calculations

### Fee Structure
- **Platform Fee:** 3.5% of subtotal
- **Stripe Fee:** 2.9% + $0.30 per transaction

### Example Calculations

**Single Ticket ($10.00):**
```
Subtotal:        $10.00
Platform Fee:    $0.35 (3.5%)
Stripe Fee:      $0.59 (2.9% + $0.30)
Processing Fee:  $0.94
─────────────────────────
Total:           $10.94
```

**Multiple Tickets (2x GA $30 + 1x VIP $90):**
```
Subtotal:        $150.00
Platform Fee:    $5.25 (3.5%)
Stripe Fee:      $4.65 (2.9% + $0.30)
Processing Fee:  $9.90
─────────────────────────
Total:           $159.90
```

---

## 🧪 Quick Test Commands

### Check Recent Orders
```sql
SELECT 
    o.id,
    o.status,
    o.total_cents / 100.0 as total_dollars,
    o.created_at,
    o.paid_at,
    COUNT(t.id) as ticket_count
FROM orders o
LEFT JOIN tickets t ON o.id = t.order_id
WHERE o.created_at > NOW() - INTERVAL '1 hour'
GROUP BY o.id
ORDER BY o.created_at DESC;
```

### Check Checkout Sessions
```sql
SELECT 
    id,
    status,
    (pricing_snapshot->>'total_cents')::int / 100.0 as total_dollars,
    expires_at,
    created_at,
    EXTRACT(EPOCH FROM (expires_at - NOW())) / 60 as minutes_remaining
FROM checkout_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Check Tickets Created
```sql
SELECT 
    t.id,
    t.qr_code,
    t.status,
    tt.name as tier_name,
    e.title as event_title,
    t.created_at
FROM tickets t
JOIN ticket_tiers tt ON t.tier_id = tt.id
JOIN events e ON tt.event_id = e.id
WHERE t.created_at > NOW() - INTERVAL '1 hour'
ORDER BY t.created_at DESC;
```

---

## 🎯 Testing Priority

1. **High Priority:** Liventix Launch (simple, single tier)
2. **Medium Priority:** Splish and Splash (multi-tier, mid-price)
3. **Low Priority:** Summer Festival (high-price, stress test)

---

## 📝 Notes

- All prices shown are in USD
- Test cards work in Stripe test mode only
- QR codes are auto-generated on ticket creation
- Session expiration is typically 15 minutes
- Hold extension adds 10 minutes

**Start with Liventix Launch for your first test!** 🚀

