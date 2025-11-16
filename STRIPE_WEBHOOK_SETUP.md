# 🔔 Stripe Webhook Configuration for Refunds

**Status:** Required before testing refunds  
**Time:** 5 minutes

---

## ⚠️ **CRITICAL: Add charge.refunded Event**

Your Stripe webhook must listen for the `charge.refunded` event to automatically process refunds initiated from Stripe Dashboard.

---

## 📝 **Setup Instructions**

### **Step 1: Go to Stripe Dashboard**

**Test Mode:**
https://dashboard.stripe.com/test/webhooks

**Production Mode (later):**
https://dashboard.stripe.com/webhooks

---

### **Step 2: Find Your Existing Webhook**

Look for the webhook with endpoint:
```
https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/stripe-webhook
```

Click on it to edit.

---

### **Step 3: Add Events**

In the "Events to send" section, ensure these are selected:

✅ **checkout.session.completed** (already have)  
✅ **payment_intent.succeeded** (already have)  
✅ **charge.refunded** ← **ADD THIS!**

---

### **Step 4: Save Changes**

Click "Save" or "Update endpoint"

---

### **Step 5: Verify Webhook Secret** (Optional, but recommended)

If you haven't set the webhook secret yet:

1. Copy the "Signing secret" from the webhook details page (starts with `whsec_...`)
2. Set it in Supabase:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_secret_here \
  --project-ref yieslxnrfeqchbcmgavz
```

---

## ✅ **Verification**

After adding the event, you should see:

```
Events to send: 3 events
  • checkout.session.completed
  • payment_intent.succeeded
  • charge.refunded
```

---

## 🎯 **What This Enables**

With `charge.refunded` enabled:

1. **Manual Refunds:** When you process a refund in Stripe Dashboard, Liventix automatically:
   - Logs the refund in `refund_log`
   - Marks tickets as refunded
   - Marks order as refunded
   - Releases inventory
   - Sends confirmation email to customer

2. **Idempotency:** Prevents duplicate processing if webhook fires multiple times

3. **Complete Audit Trail:** Every refund is logged with Stripe refund ID

---

## 🧪 **Test the Webhook**

After setup, test it:

1. Go to Stripe Dashboard → Payments
2. Find a test order
3. Click "Refund" and process full refund
4. Check Supabase Edge Function logs for `stripe-webhook`
5. Should see: "Refund processed successfully"
6. Check database:

```sql
SELECT * FROM ticketing.refund_log 
ORDER BY processed_at DESC 
LIMIT 1;
```

Should show the refund with `stripe_event_id` populated.

---

## 🚨 **Common Issues**

**Issue:** Webhook returns 401 Unauthorized  
**Fix:** Verify `STRIPE_WEBHOOK_SECRET` is set correctly

**Issue:** Webhook returns 500 Internal Server Error  
**Fix:** Check Edge Function logs for specific error

**Issue:** Refund not logged in database  
**Fix:** Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in secrets

---

## ✅ **You're Done!**

Once the webhook is updated, your refund system is fully operational! 🎉

Move on to testing the customer and organizer flows.



