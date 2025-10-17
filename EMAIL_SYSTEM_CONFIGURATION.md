# 📧 Email System Configuration - Complete Guide

## ✅ **What Was Fixed**

### **Problem:**
Purchase confirmation emails were not being sent after successful ticket purchases because the Stripe webhook was only marking orders as paid but **not triggering the email sending flow**.

### **Solution:**
Updated `stripe-webhook` function to call `process-payment`, which handles:
1. ✅ Ticket creation
2. ✅ Email sending via `send-purchase-confirmation`
3. ✅ Order fulfillment

---

## 🔄 **Email Flow (How It Works Now)**

```
User completes Stripe checkout
         ↓
Stripe sends webhook: checkout.session.completed
         ↓
stripe-webhook Edge Function receives it
         ↓
Calls process-payment Edge Function
         ↓
process-payment does:
  1. Marks order as paid
  2. Creates tickets via ensure-tickets
  3. Retrieves user email (auth.users or order.contact_email)
  4. Calls send-purchase-confirmation Edge Function
         ↓
send-purchase-confirmation does:
  1. Fetches event/org context
  2. Renders beautiful HTML email
  3. Sends via Resend API
         ↓
Customer receives email with:
  ✅ Purchase confirmation
  ✅ Event details
  ✅ Ticket information
  ✅ QR codes (if enabled)
  ✅ "View Your Tickets" button
```

---

## 📧 **Email Types Configured**

### **1. Purchase Confirmation** ✅
- **Trigger**: After successful Stripe payment
- **Function**: `send-purchase-confirmation`
- **From**: `YardPass <noreply@yardpass.tech>` (or org-branded)
- **Reply-To**: `support@yardpass.tech`
- **Contents**: Order details, tickets, event info, QR codes

### **2. Guest Access Code (OTP)** ✅
- **Trigger**: When guest requests ticket access
- **Function**: `guest-tickets-start`
- **From**: `YardPass <noreply@yardpass.tech>`
- **Contents**: 6-digit OTP code, expires in 5 minutes

### **3. Ticket Reminders** ✅
- **Trigger**: Scheduled reminders before events
- **Function**: `send-ticket-reminder`
- **From**: `YardPass <noreply@yardpass.tech>` (or org-branded)
- **Reply-To**: `support@yardpass.tech`

### **4. Role Invites** ✅
- **Trigger**: When user is invited to help at an event
- **Function**: `send-role-invite`
- **From**: `YardPass <noreply@yardpass.tech>`
- **Reply-To**: `support@yardpass.tech`

---

## 🔧 **Configuration Requirements**

### **1. Resend API Setup**
✅ Domain: `yardpass.tech` must be verified in Resend dashboard
✅ Sender email: `noreply@yardpass.tech` verified
✅ Reply-to email: `support@yardpass.tech` verified
✅ API Key: `RESEND_API_KEY` set in Supabase environment variables

### **2. Supabase Edge Functions**
✅ `stripe-webhook` - Deployed
✅ `process-payment` - Deployed
✅ `send-purchase-confirmation` - Deployed
✅ `ensure-tickets` - Deployed
✅ `guest-tickets-start` - Deployed
✅ `send-ticket-reminder` - Deployed
✅ `send-role-invite` - Deployed

### **3. Stripe Webhook**
✅ Webhook URL: `https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/stripe-webhook`
✅ Events: `checkout.session.completed`, `checkout.session.expired`
✅ Secret: `STRIPE_WEBHOOK_SECRET` set in environment

---

## 🧪 **How to Test**

### **Test 1: Purchase Confirmation Email**

1. **Make a test purchase:**
   - Go to any event
   - Click "Get Tickets"
   - Complete checkout with Stripe test card: `4242 4242 4242 4242`

2. **Check Supabase logs:**
   ```bash
   # View stripe-webhook logs
   npx supabase functions logs stripe-webhook --tail
   
   # View process-payment logs
   npx supabase functions logs process-payment --tail
   
   # View send-purchase-confirmation logs
   npx supabase functions logs send-purchase-confirmation --tail
   ```

3. **Expected log sequence:**
   ```
   [STRIPE-WEBHOOK] Webhook received
   [STRIPE-WEBHOOK] Event received: checkout.session.completed
   [STRIPE-WEBHOOK] Order found
   [STRIPE-WEBHOOK] Calling process-payment function
   [PROCESS-PAYMENT] Function started
   [PROCESS-PAYMENT] Order found
   [PROCESS-PAYMENT] Tickets ensured
   [PROCESS-PAYMENT] Sending purchase confirmation email
   [PROCESS-PAYMENT] Purchase confirmation email sent successfully
   [STRIPE-WEBHOOK] process-payment succeeded
   ```

4. **Check your email inbox:**
   - Look for email from `YardPass <noreply@yardpass.tech>`
   - Subject: `✅ Ticket Confirmation - [Event Name]`
   - Should contain order details, tickets, and "View Your Tickets" button

### **Test 2: Guest Access Code Email**

1. **Request guest access:**
   - Go to guest ticket retrieval page
   - Enter email address
   - Click "Send Code"

2. **Check email:**
   - Should receive 6-digit OTP code
   - Valid for 5 minutes

---

## 📊 **Monitoring & Debugging**

### **Check if emails are being sent:**

1. **Resend Dashboard:**
   - Go to https://resend.com/emails
   - View sent emails, delivery status, opens, clicks

2. **Supabase Logs:**
   ```bash
   # Real-time logs for all email functions
   npx supabase functions logs send-purchase-confirmation --tail
   ```

3. **Database Queries:**
   ```sql
   -- Check recent orders
   SELECT 
     id,
     status,
     paid_at,
     contact_email,
     created_at
   FROM orders
   WHERE status = 'paid'
   ORDER BY created_at DESC
   LIMIT 10;

   -- Check tickets created
   SELECT 
     t.id,
     t.order_id,
     t.created_at,
     o.contact_email
   FROM tickets t
   JOIN orders o ON t.order_id = o.id
   ORDER BY t.created_at DESC
   LIMIT 10;
   ```

### **Common Issues & Fixes:**

#### **Issue 1: No email received**
- ✅ Check spam/junk folder
- ✅ Verify Resend API key is set: `RESEND_API_KEY`
- ✅ Check Resend dashboard for delivery errors
- ✅ Verify domain is verified in Resend

#### **Issue 2: Webhook not firing**
- ✅ Check Stripe webhook configuration
- ✅ Verify webhook secret: `STRIPE_WEBHOOK_SECRET`
- ✅ Check Stripe dashboard > Webhooks > Event logs

#### **Issue 3: Email sending but not arriving**
- ✅ Check Resend dashboard for bounce/complaint
- ✅ Verify recipient email is valid
- ✅ Check email provider's spam filter

---

## 🎯 **Email Templates**

### **Purchase Confirmation Template Structure:**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body>
    <!-- Header with Logo -->
    <div style="background: #1a1a1a; padding: 24px;">
      <img src="[org-logo or yardpass-logo]" alt="YardPass" />
    </div>

    <!-- Success Banner -->
    <div style="background: #10b981; color: white; padding: 16px;">
      🎉 Purchase Confirmed!
    </div>

    <!-- Event Details -->
    <div>
      <h2>Hi [Customer Name],</h2>
      <p>Thank you for your purchase!</p>
      
      <!-- Event Info -->
      📅 [Date]
      📍 [Location]
      🏛️ [Venue]

      <!-- Ticket Info -->
      🎫 [Ticket Type] × [Quantity]
      💰 Total: $[Amount]
      Order #[Order ID]

      <!-- QR Code (if enabled) -->
      <img src="[qr-code-url]" alt="QR Code" />

      <!-- CTA Button -->
      <a href="[base-url]/tickets">View Your Tickets</a>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 24px;">
      Powered by YardPass · Organized by [Org Name]
      Questions? Contact support@yardpass.tech
    </div>
  </body>
</html>
```

---

## 🚀 **Next Steps**

### **1. Production Deployment**
- ✅ All functions are deployed
- ✅ Webhook is configured
- ✅ Emails are enabled

### **2. Monitoring**
- Set up Resend webhook for bounce/complaint notifications
- Monitor Supabase function logs for errors
- Track email delivery rates in Resend dashboard

### **3. Future Enhancements**
- [ ] Add email preferences (opt-in/opt-out)
- [ ] Add email templates for event updates
- [ ] Add email templates for refunds
- [ ] Add SMS notifications (via Twilio)
- [ ] Add push notifications

---

## 📝 **Summary**

### **Before Fix:**
❌ Stripe webhook only marked orders as paid
❌ No tickets created automatically
❌ No emails sent
❌ Users had to manually trigger via success page

### **After Fix:**
✅ Stripe webhook calls process-payment
✅ Tickets created automatically
✅ Emails sent immediately
✅ Works even if user closes browser

---

## 🎉 **You're All Set!**

Your email system is now fully configured and operational. Customers will receive beautiful, branded confirmation emails immediately after purchase, regardless of whether they return to your site after checkout.

**Test it now by making a purchase!** 🎫



