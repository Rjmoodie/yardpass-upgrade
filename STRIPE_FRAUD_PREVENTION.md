# Stripe Fraud Prevention Configuration

## Overview
This document outlines the fraud prevention measures to implement in your Stripe account and Liventix codebase.

## ⚠️ Critical Security Measures

### 1. Enable Stripe Radar (Automatic Fraud Detection)

**Action:** Enable in Stripe Dashboard
- Go to: [Stripe Dashboard](https://dashboard.stripe.com/settings/radar) → Radar → Enable
- **Cost:** Included in Stripe pricing (0.05¢ per screened transaction)
- **Benefit:** Machine learning fraud detection on all charges

**Rules to Enable:**
```
✅ Block if CVC fails
✅ Block if postal code fails  
✅ Block if address verification fails
✅ Review if risk score > 65 (Stripe ML model)
✅ Review if velocity check fails (multiple cards from same IP)
```

---

### 2. Add Custom Radar Rules

Navigate to: Stripe Dashboard → Radar → Rules

**Rule 1: Velocity Protection (Card Testing)**
```
Block if :card_country: != 'US' AND :amount: < 500
```
*Prevents international low-value card testing*

**Rule 2: High-Value Transaction Review**
```
Review if :amount: > 50000
```
*Manual review for purchases > $500*

**Rule 3: Multiple Failed Attempts**
```
Block if :ip_address_block_attempts_count: > 3
```
*Block IPs with multiple failed payment attempts*

**Rule 4: Suspicious Velocity**
```
Review if :email_domain_attempts_count_1h: > 5
```
*Flag if same email domain tries 5+ purchases in 1 hour*

---

### 3. Implement 3D Secure (SCA) for High-Risk Transactions

**Update checkout functions:**

```typescript
// In create-checkout/index.ts and enhanced-checkout/index.ts
const session = await stripe.checkout.sessions.create({
  // ... existing config
  
  payment_method_options: {
    card: {
      request_three_d_secure: 'automatic', // Enable 3DS for high-risk
    },
  },
  
  // Add metadata for Radar
  payment_intent_data: {
    metadata: {
      user_id: user.id,
      event_id: eventId,
      order_total_cents: totalCents,
      risk_context: 'ticket_purchase'
    },
    // Optional: description for better fraud analysis
    description: `Ticket purchase for event ${eventId}`,
  },
  
  // ... rest of config
});
```

---

### 4. Add Velocity Limits in Code

**Create: `supabase/functions/check-purchase-velocity/index.ts`**

```typescript
// Check if user has exceeded purchase limits
export async function checkPurchaseVelocity(userId: string, amountCents: number) {
  const supabase = createClient(...);
  
  // Check purchases in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: recentPurchases, error } = await supabase
    .from("invoices")
    .select("amount_usd_cents")
    .or(`purchased_by_user_id.eq.${userId},wallet_id.in.(select id from wallets where user_id='${userId}')`)
    .gte("created_at", oneHourAgo)
    .eq("status", "paid");
  
  if (error) throw error;
  
  const totalSpent = recentPurchases.reduce((sum, inv) => sum + (inv.amount_usd_cents || 0), 0);
  const purchaseCount = recentPurchases.length;
  
  // Limits:
  // - Max 5 purchases per hour
  // - Max $500 per hour
  if (purchaseCount >= 5) {
    throw new Error("Purchase limit exceeded: maximum 5 purchases per hour");
  }
  
  if (totalSpent + amountCents > 50000) { // $500
    throw new Error("Purchase limit exceeded: maximum $500 per hour");
  }
  
  return true;
}
```

**Update purchase functions to call this:**

```typescript
// In purchase-credits/index.ts and purchase-org-credits/index.ts
// Before creating Stripe session:

// Velocity check
try {
  await checkPurchaseVelocity(user.id, finalAmount);
} catch (velocityError) {
  console.warn(`[purchase] Velocity limit hit for user ${user.id}`);
  return new Response(
    JSON.stringify({ 
      error: velocityError.message,
      retry_after: 3600 // seconds
    }),
    { 
      status: 429, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}
```

---

### 5. Monitor Suspicious Patterns

**Create: `supabase/migrations/20250113000002_fraud_monitoring_views.sql`**

```sql
-- View for flagging suspicious activity
CREATE OR REPLACE VIEW fraud_alerts AS
SELECT 
  i.id,
  i.purchased_by_user_id,
  i.amount_usd_cents,
  i.created_at,
  COUNT(*) OVER (
    PARTITION BY i.purchased_by_user_id 
    ORDER BY i.created_at 
    RANGE BETWEEN INTERVAL '1 hour' PRECEDING AND CURRENT ROW
  ) as purchases_last_hour,
  SUM(i.amount_usd_cents) OVER (
    PARTITION BY i.purchased_by_user_id 
    ORDER BY i.created_at 
    RANGE BETWEEN INTERVAL '1 hour' PRECEDING AND CURRENT ROW
  ) as total_spent_last_hour
FROM invoices i
WHERE i.status = 'paid'
  AND i.created_at > now() - INTERVAL '24 hours';

-- Alert if suspicious
CREATE OR REPLACE VIEW high_risk_purchases AS
SELECT *
FROM fraud_alerts
WHERE purchases_last_hour > 3
   OR total_spent_last_hour > 50000;
```

---

## 📊 Implementation Checklist

### Stripe Dashboard (No Code)
- [ ] Enable Stripe Radar
- [ ] Configure custom Radar rules (see above)
- [ ] Set up email alerts for high-risk transactions
- [ ] Enable 3D Secure for international cards

### Code Changes
- [ ] Add `stripe_customer_id` to `user_profiles` table
- [ ] Create `customer-portal` edge function (✅ Done)
- [ ] Add velocity check to purchase functions
- [ ] Update checkout to request 3DS
- [ ] Add fraud metadata to payment intents
- [ ] Create fraud monitoring views
- [ ] Add admin dashboard for high-risk alerts

### Testing
- [ ] Test with Stripe test cards (4000000000003220 - 3DS required)
- [ ] Test velocity limits
- [ ] Test Radar rules
- [ ] Test customer portal access

---

## 🚨 Test Cards for Fraud Prevention

Use these in test mode:

| Card Number | Scenario |
|-------------|----------|
| `4000000000003220` | Requires 3D Secure authentication |
| `4000000000009995` | Always declined (insufficient funds) |
| `4000000000000002` | Always declined (generic) |
| `4100000000000019` | Fraudulent (blocked by Radar) |
| `4000008400001629` | High risk (may require review) |

---

## 📈 Monitoring

**Add to your analytics dashboard:**
1. Failed payment rate
2. 3DS completion rate
3. Radar review rate
4. Chargeback rate (should be < 0.5%)
5. Velocity limit hits

---

## 🔒 Additional Security

### Rate Limiting
Add to Edge Functions:
```typescript
// Check if too many requests from same IP
const { data: rateLimitCheck } = await supabase.rpc('check_rate_limit', {
  p_identifier: ipAddress,
  p_max_requests: 10,
  p_window_seconds: 60
});

if (!rateLimitCheck.allowed) {
  return new Response('Too many requests', { status: 429 });
}
```

### IP Blocking
Maintain blocklist for known fraudulent IPs:
```sql
CREATE TABLE blocked_ips (
  ip_address TEXT PRIMARY KEY,
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🎯 Priority Order

1. 🔴 **Enable Radar** (5 minutes, Dashboard only)
2. 🔴 **Add 3DS to checkout** (30 minutes, code update)
3. 🟡 **Velocity limits** (1 hour, new function)
4. 🟡 **Custom Radar rules** (30 minutes, Dashboard)
5. 🟢 **Monitoring views** (1 hour, SQL)
6. 🟢 **Customer portal** (✅ Already done)

---

## 📞 Support

If you detect fraud:
1. Contact Stripe support immediately
2. Freeze affected wallet
3. Review transaction logs
4. File dispute if necessary

**Stripe Fraud Report:** support+fraud@stripe.com

