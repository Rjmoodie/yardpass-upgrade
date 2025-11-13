# 🧪 Frontend Testing Guide - Liventix Checkout System

## Overview
This guide will walk you through testing your modernized checkout system with real event data using the frontend interface.

## Prerequisites
- Local development server running (`npm run dev`)
- Real events and tiers in your database (confirmed ✅)
- Stripe test mode enabled

---

## 📋 Test Scenarios

### **Test 1: Guest Checkout - Single Ticket**

**Event:** Liventix Launch  
**Tier:** General Admission ($10.00)  
**Tier ID:** `a496a470-0f96-4ee6-aa3e-5d6628623686`

**Steps:**
1. Make sure you're **logged out** (clear cookies if needed)
2. Navigate to the Liventix Launch event page
3. Click "Purchase Tickets"
4. Select **1x General Admission** ticket
5. Enter guest email: `test-guest@liventix.com`
6. Enter guest name: `Test Guest`
7. Click "Purchase" button

**Expected Results:**
- ✅ Email validation passes
- ✅ Redirect to Stripe checkout page
- ✅ Checkout session ID stored in localStorage
- ✅ Order created in database with status 'pending'
- ✅ Session recovery works if you navigate back

**What to Check:**
```sql
-- Check if order was created
SELECT * FROM orders 
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC LIMIT 5;

-- Check if checkout session was created
SELECT * FROM checkout_sessions 
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC LIMIT 5;
```

---

### **Test 2: Guest Checkout - Multiple Tickets (Mixed Tiers)**

**Event:** Splish and Splash  
**Tiers:** 
- General Admission ($30.00) - Qty: 2
- VIP ($90.00) - Qty: 1

**Steps:**
1. Ensure you're logged out
2. Navigate to the Splish and Splash event
3. Click "Purchase Tickets"
4. Select **2x General Admission**
5. Select **1x VIP**
6. Enter email: `multi-ticket@liventix.com`
7. Click "Purchase"

**Expected Results:**
- ✅ Order summary shows: $150.00 subtotal (2×$30 + 1×$90)
- ✅ Processing fees calculated correctly
- ✅ Total amount displayed accurately
- ✅ Redirect to Stripe with correct amount
- ✅ All 3 tickets reserved in database

**Database Check:**
```sql
-- Check order items
SELECT 
    o.id,
    o.total_cents,
    COUNT(oi.id) as item_count,
    SUM(oi.quantity) as total_tickets
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.created_at > NOW() - INTERVAL '5 minutes'
GROUP BY o.id, o.total_cents;
```

---

### **Test 3: Member Checkout**

**Event:** Summer Music Festival 2024  
**Tier:** General Admission ($50.00) - Qty: 2

**Steps:**
1. **Log in** to your Liventix account
2. Navigate to Summer Music Festival 2024
3. Click "Purchase Tickets"
4. Select **2x General Admission**
5. Click "Purchase"

**Expected Results:**
- ✅ No email/name fields shown (you're logged in)
- ✅ User ID attached to order
- ✅ Enhanced checkout endpoint used
- ✅ Checkout session created with user_id
- ✅ Redirect to Stripe

**Database Check:**
```sql
-- Verify user_id is set
SELECT 
    o.id,
    o.user_id,
    o.total_cents,
    u.email as user_email
FROM orders o
LEFT JOIN auth.users u ON o.user_id = u.id
WHERE o.created_at > NOW() - INTERVAL '5 minutes'
AND o.user_id IS NOT NULL
ORDER BY o.created_at DESC;
```

---

### **Test 4: Session Countdown Timer**

**Steps:**
1. Start any checkout flow (guest or member)
2. Add tickets to cart
3. Click "Purchase" to initiate checkout
4. **Before completing payment**, look for the countdown timer

**Expected UI Elements:**
- ⏰ Orange card showing "Tickets Reserved"
- ⏱️  Countdown timer showing minutes:seconds
- 🔄 Timer updates in real-time (polls every 5 seconds)
- ➕ "Extend Hold" button appears when < 5 minutes remain

**Test Extension:**
1. Wait until timer shows < 5 minutes
2. Click "Extend Hold (+10 min)" button
3. Timer should reset/extend

---

### **Test 5: Cart Recovery (Abandoned Session)**

**Steps:**
1. Start a checkout flow and get redirected to Stripe
2. **Close the Stripe page** (don't complete payment)
3. Go back to the event page
4. Open the ticket purchase modal again

**Expected Results:**
- 💙 Blue notification: "Cart Recovered"
- 📦 Message: "We found your previous session. Your tickets are still reserved."
- ⏰ Countdown timer shows remaining time
- 🔄 Session status polls automatically

**Database Check:**
```sql
-- Check session status
SELECT 
    id,
    status,
    expires_at,
    created_at,
    EXTRACT(EPOCH FROM (expires_at - NOW())) / 60 as minutes_remaining
FROM checkout_sessions
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT 5;
```

---

### **Test 6: Express Payment Methods (UI Only)**

**Note:** Express payment methods are currently UI stubs. They'll show a "coming soon" toast.

**Steps:**
1. Start any checkout flow with tickets selected
2. Look for "Express Checkout" section
3. You should see buttons for:
   - 🍎 Apple Pay
   - G Google Pay
   - 📶 Stripe Link

**Expected Results:**
- ✅ Buttons render correctly
- ✅ Clicking shows "coming soon" toast
- ✅ UI is visually appealing and accessible

---

### **Test 7: Complete Purchase with Stripe Test Cards**

**Steps:**
1. Complete any checkout flow above
2. On Stripe checkout page, use test cards:

**Test Cards:**
```
✅ Success (Payment Succeeds):
   Card: 4242 4242 4242 4242
   Exp: Any future date (e.g., 12/34)
   CVC: Any 3 digits (e.g., 123)
   ZIP: Any 5 digits (e.g., 12345)

❌ Decline (Payment Fails):
   Card: 4000 0000 0000 0002

🔐 3D Secure (Requires Authentication):
   Card: 4000 0027 6000 3184
```

3. Complete the payment

**Expected Results:**
- ✅ Stripe webhook triggers `process-payment` function
- ✅ Order status updates to 'paid'
- ✅ Tickets created with QR codes
- ✅ Confirmation email sent
- ✅ Checkout session status updates to 'converted'

**Database Verification:**
```sql
-- Check completed order
SELECT 
    o.id,
    o.status,
    o.stripe_session_id,
    o.paid_at,
    COUNT(t.id) as ticket_count,
    STRING_AGG(t.qr_code, ', ') as qr_codes
FROM orders o
LEFT JOIN tickets t ON o.id = t.order_id
WHERE o.status = 'paid'
  AND o.paid_at > NOW() - INTERVAL '10 minutes'
GROUP BY o.id, o.status, o.stripe_session_id, o.paid_at
ORDER BY o.paid_at DESC;
```

---

## 🔍 Edge Function Logs to Monitor

Open your Supabase Dashboard > Edge Functions > Logs to monitor:

1. **guest-checkout** - Guest purchase initiation
2. **enhanced-checkout** - Member purchase initiation
3. **checkout-session-status** - Session polling (should see frequent calls)
4. **stripe-webhook** - Payment completion events
5. **process-payment** - Ticket creation and email sending

---

## 🐛 Common Issues & Solutions

### Issue: "No tickets selected"
- **Solution:** Make sure at least 1 ticket is selected before clicking "Purchase"

### Issue: "Email required"
- **Solution:** Enter a valid email address in the guest checkout form

### Issue: "Authentication required"
- **Solution:** For member checkout, make sure you're logged in

### Issue: "Invalid JWT"
- **Solution:** This is expected for unauthenticated API calls. Guest checkout and session-status use anon key authentication.

### Issue: Timer not showing
- **Solution:** Make sure `checkoutSessionId` is returned from the Edge Function. Check the function response in browser DevTools.

### Issue: Session recovery not working
- **Solution:** Check localStorage for `checkoutSessionId`. Clear it if stale: `localStorage.removeItem('checkoutSessionId')`

---

## ✅ Success Criteria

Your system is working correctly if:

1. ✅ Guest checkout creates orders and redirects to Stripe
2. ✅ Member checkout requires authentication
3. ✅ Countdown timer displays and updates in real-time
4. ✅ Cart recovery detects abandoned sessions
5. ✅ Complete purchases create tickets with QR codes
6. ✅ Confirmation emails are sent
7. ✅ Express payment UI elements render correctly
8. ✅ All Edge Functions log properly without errors

---

## 🚀 Production Readiness Checklist

Before going live:

- [ ] Test all scenarios above successfully
- [ ] Verify Stripe webhooks are working
- [ ] Confirm emails are being sent
- [ ] Test mobile responsive design
- [ ] Verify QR codes are scannable
- [ ] Test with different browsers (Chrome, Safari, Firefox)
- [ ] Load test with multiple concurrent users
- [ ] Set up monitoring/alerts for failed payments
- [ ] Document any custom configurations
- [ ] Train support staff on common issues

---

## 📊 Performance Metrics to Track

Monitor these in production:

- **Conversion Rate:** (Completed Checkouts / Started Checkouts) × 100
- **Abandonment Rate:** (Abandoned Sessions / Total Sessions) × 100
- **Average Checkout Time:** Time from "Purchase" to payment completion
- **Session Recovery Rate:** (Recovered Sessions / Abandoned Sessions) × 100
- **Payment Success Rate:** (Successful Payments / Total Attempts) × 100

---

## 🎯 Next Steps

1. **Complete all test scenarios** in this guide
2. **Review Edge Function logs** for any errors
3. **Verify database records** match expected results
4. **Test mobile experience** on actual devices
5. **Share with beta users** for real-world feedback
6. **Monitor production metrics** after launch

---

**Your system is enterprise-ready!** 🚀

If you encounter any issues during testing, check:
1. Edge Function logs in Supabase Dashboard
2. Browser console for frontend errors
3. Network tab for API responses
4. Database records for data consistency

