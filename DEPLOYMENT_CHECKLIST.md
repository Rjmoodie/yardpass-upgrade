# YardPass 3.0 - Stripe Enhancement Deployment Checklist

## 📋 Pre-Deployment Verification

- [ ] All code changes reviewed
- [ ] No linting errors
- [ ] Migrations tested locally
- [ ] Edge functions tested locally

---

## 🗄️ Database Migrations

Run these in order:

```bash
# 1. Credit lot system (core tables and functions)
supabase migration up --file 20250113000001_add_credit_lots_system.sql

# 2. Stripe customer ID for portal
supabase migration up --file 20250113000002_add_stripe_customer_id.sql
```

**Verify:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'credit_lots';

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('deduct_credits_fifo', 'get_available_credits', 'get_credit_lot_breakdown');

-- Check column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND column_name = 'stripe_customer_id';
```

---

## 🚀 Edge Function Deployments

Deploy in this order:

```bash
# 1. Webhook handler (processes credit lots)
supabase functions deploy wallet-stripe-webhook

# 2. Purchase functions (updated with attribution)
supabase functions deploy purchase-credits
supabase functions deploy purchase-org-credits

# 3. Spending function (FIFO deduction)
supabase functions deploy internal-spend

# 4. New customer portal
supabase functions deploy customer-portal

# 5. Updated checkout (fraud prevention)
supabase functions deploy create-checkout
```

**Verify:**
```bash
# Check function status
supabase functions list

# Test functions
curl -X POST https://your-project.supabase.co/functions/v1/customer-portal \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"return_url": "https://app.yardpass.com/wallet"}'
```

---

## 🔐 Stripe Dashboard Configuration

### **1. Enable Stripe Radar** (5 min)
- [ ] Go to: [Stripe Dashboard → Radar](https://dashboard.stripe.com/settings/radar)
- [ ] Click "Enable Radar"
- [ ] Confirm pricing: $0.05 per screened transaction

### **2. Configure Radar Rules** (10 min)
Navigate to: Stripe Dashboard → Radar → Rules

**Add these rules:**

```
Rule 1: Block low-value international
Block if :card_country: != 'US' AND :amount: < 500

Rule 2: Review high-value purchases  
Review if :amount: > 50000

Rule 3: Block multiple failures
Block if :ip_address_block_attempts_count: > 3

Rule 4: Review email velocity
Review if :email_domain_attempts_count_1h: > 5
```

- [ ] Rule 1 added
- [ ] Rule 2 added
- [ ] Rule 3 added
- [ ] Rule 4 added

### **3. Configure Fraud Alerts** (5 min)
- [ ] Go to: Stripe Dashboard → Radar → Alerts
- [ ] Enable email alerts for:
  - [ ] High-risk payments
  - [ ] Blocked payments
  - [ ] Disputed payments

### **4. Enable Customer Portal** (2 min)
- [ ] Go to: [Stripe Dashboard → Settings → Customer Portal](https://dashboard.stripe.com/settings/billing/portal)
- [ ] Click "Activate portal"
- [ ] Configure features:
  - [ ] ✅ Invoice history
  - [ ] ✅ Payment methods
  - [ ] ❌ Cancel subscription (not applicable)
  - [ ] ❌ Update subscription (not applicable)

---

## 🧪 Testing Checklist

### **1. Credit Lot Creation**
```bash
# Test user credit purchase
curl -X POST https://your-project.supabase.co/functions/v1/purchase-credits \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-$(date +%s)" \
  -d '{"package_id": "starter-package-id"}'

# Verify lot created:
SELECT * FROM credit_lots WHERE wallet_id = 'user-wallet-id';
```

- [ ] User credit purchase creates lot
- [ ] Org credit purchase creates lot
- [ ] purchased_by_user_id is set
- [ ] unit_price_cents is correct
- [ ] expires_at is NULL

### **2. FIFO Deduction**
```bash
# Trigger ad spend
curl -X POST https://your-project.supabase.co/functions/v1/internal-spend \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: spend-test-$(date +%s)" \
  -d '{
    "campaign_id": "uuid",
    "org_wallet_id": "uuid",
    "metric_type": "impression",
    "quantity": 1000,
    "rate_model": "cpm",
    "rate_usd_cents": 500
  }'

# Verify FIFO deduction:
SELECT * FROM credit_lots 
WHERE org_wallet_id = 'uuid' 
ORDER BY created_at ASC;
```

- [ ] Oldest lot deducted first
- [ ] quantity_remaining updated
- [ ] depleted_at set when lot empty
- [ ] metadata.lots_used tracked in transaction

### **3. Fraud Prevention**
Use Stripe test cards:

```
4000000000003220 - Requires 3D Secure
4242424242424242 - Standard success
4100000000000019 - Fraudulent (Radar blocks)
```

- [ ] 3DS challenged on test card
- [ ] Billing address required
- [ ] Metadata appears in Stripe Dashboard
- [ ] Radar rule triggers (if configured)

### **4. Customer Portal**
```typescript
// Test portal access
const { data } = await supabase.functions.invoke('customer-portal', {
  body: { return_url: '/wallet' }
});

// Should return: { url: 'https://billing.stripe.com/session/...' }
```

- [ ] Portal URL generated
- [ ] stripe_customer_id saved
- [ ] Invoices visible in portal
- [ ] Receipts downloadable

---

## 📊 Monitoring Setup

### **1. Add Database Monitoring**
```sql
-- Create monitoring view
CREATE OR REPLACE VIEW credit_system_health AS
SELECT 
  'Total Lots' as metric,
  COUNT(*) as value
FROM credit_lots
UNION ALL
SELECT 
  'Active Lots',
  COUNT(*)
FROM credit_lots
WHERE quantity_remaining > 0
UNION ALL
SELECT 
  'Depleted Lots',
  COUNT(*)
FROM credit_lots
WHERE quantity_remaining = 0
UNION ALL
SELECT 
  'Total Credits Available',
  SUM(quantity_remaining)::bigint
FROM credit_lots
WHERE quantity_remaining > 0;

-- Query health
SELECT * FROM credit_system_health;
```

### **2. Set Up Alerts**
- [ ] Stripe Radar alert emails configured
- [ ] Low balance alerts (if using auto-reload)
- [ ] Failed payment alerts
- [ ] Chargeback alerts

---

## 🔄 Rollback Plan

If critical issues arise:

### **Database Rollback**
```bash
# Rollback in reverse order
supabase migration down --version 20250113000002
supabase migration down --version 20250113000001
```

### **Edge Function Rollback**
```bash
# Get previous version from git
git checkout HEAD~1 supabase/functions/wallet-stripe-webhook/index.ts
git checkout HEAD~1 supabase/functions/purchase-credits/index.ts
git checkout HEAD~1 supabase/functions/purchase-org-credits/index.ts
git checkout HEAD~1 supabase/functions/internal-spend/index.ts

# Redeploy
supabase functions deploy wallet-stripe-webhook
supabase functions deploy purchase-credits
supabase functions deploy purchase-org-credits
supabase functions deploy internal-spend
```

---

## ✅ Post-Deployment Validation

### **Immediate (First Hour)**
- [ ] Monitor Stripe webhook dashboard for errors
- [ ] Check Supabase function logs for errors
- [ ] Test 1 real purchase (small amount)
- [ ] Verify credit lot created
- [ ] Verify balance updated

### **First Day**
- [ ] Monitor transaction volume
- [ ] Check for Radar blocks (false positives?)
- [ ] Verify 3DS completion rate
- [ ] Check customer portal usage
- [ ] Review any failed payments

### **First Week**
- [ ] Analyze lot fragmentation
- [ ] Review FIFO performance
- [ ] Check attribution data quality
- [ ] Monitor chargeback rate
- [ ] Gather user feedback on portal

---

## 📈 Success Metrics

**Week 1 Targets:**
- ✅ 0 critical errors in webhooks
- ✅ 100% of purchases create lots
- ✅ 100% of spends use FIFO
- ✅ < 1% false positive Radar blocks
- ✅ > 95% 3DS completion rate

**Month 1 Targets:**
- ✅ < 0.5% chargeback rate
- ✅ > 80% customer portal satisfaction
- ✅ 0 double-charge incidents (idempotency working)
- ✅ Accurate attribution for all org purchases

---

## 🚨 Emergency Contacts

**Stripe Issues:**
- Support: https://support.stripe.com
- Phone: Check your Stripe Dashboard for support number
- Status: https://status.stripe.com

**Supabase Issues:**
- Support: https://supabase.com/support
- Status: https://status.supabase.com

**YardPass Team:**
- Engineering lead: [Add contact]
- On-call: [Add rotation]

---

## 📝 Documentation Links

- **Credit System:** See `CREDIT_SYSTEM_QUICK_REFERENCE.md`
- **Fraud Prevention:** See `STRIPE_FRAUD_PREVENTION.md`
- **Full Summary:** See `STRIPE_IMPLEMENTATION_SUMMARY.md`
- **Connect Integration:** See `STRIPE_CONNECT_INTEGRATION.md`

---

## 🎯 Final Checklist

**Before Going Live:**
- [ ] All migrations applied
- [ ] All edge functions deployed
- [ ] Stripe Radar enabled
- [ ] Radar rules configured
- [ ] Customer portal activated
- [ ] Test purchases completed
- [ ] Monitoring dashboards ready
- [ ] Team trained on new features
- [ ] Documentation shared
- [ ] Rollback plan reviewed

**After Going Live:**
- [ ] Monitor for first 24 hours
- [ ] Daily checks for first week
- [ ] Weekly review for first month
- [ ] Gather user feedback
- [ ] Optimize based on data

---

**Ready to deploy! 🚀**

Estimated total deployment time: **45 minutes**
- Database migrations: 5 min
- Edge function deployment: 15 min
- Stripe Dashboard config: 20 min
- Testing: 5 min

