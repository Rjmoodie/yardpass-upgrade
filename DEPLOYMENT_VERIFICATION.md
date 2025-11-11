# 🔍 Deployment Verification Checklist

**Phase 1 Stripe Fixes - Post-Deployment Testing**  
**Date:** November 10, 2025

---

## ✅ Quick Smoke Tests

### 1. **Fee Calculation Consistency**

**Test Guest Checkout:**
```bash
# Make a guest checkout request with a $10 ticket
curl -X POST https://your-project.supabase.co/functions/v1/guest-checkout \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "test-event-id",
    "items": [{"tier_id": "tier-id", "quantity": 1}],
    "contact_email": "test@example.com",
    "contact_name": "Test User"
  }'
```

**Expected Result:**
- ✅ Total fee should be ~$3.50 for $10 ticket (not $4.40)
- ✅ `fees_cents` in response should be ~350

---

### 2. **Org Balance Access**

**Test as Org Admin/Editor:**
```bash
# Get Stripe balance for an organization
curl -X POST https://your-project.supabase.co/functions/v1/get-stripe-balance \
  -H "Authorization: Bearer $USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "context_type": "organization",
    "context_id": "org-uuid-here"
  }'
```

**Expected Result:**
- ✅ Should return balance (not "Unauthorized")
- ✅ Admin, editor, and owner roles should all work
- ❌ Viewer role should fail

---

### 3. **Payout Rate Limiting**

**Test Rate Limit:**
```bash
# Request 4 payouts in quick succession
for i in {1..4}; do
  curl -X POST https://your-project.supabase.co/functions/v1/create-payout \
    -H "Authorization: Bearer $USER_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "context_type": "organization",
      "context_id": "org-uuid-here",
      "amount_cents": 2000
    }'
  echo ""
done
```

**Expected Result:**
- ✅ First 3 requests should succeed
- ❌ 4th request should fail with:
  - HTTP 429 (Too Many Requests)
  - Error: "Payout request limit exceeded"

---

### 4. **Minimum Payout Amount**

**Test Minimum:**
```bash
# Try to request a $5 payout
curl -X POST https://your-project.supabase.co/functions/v1/create-payout \
  -H "Authorization: Bearer $USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "context_type": "organization",
    "context_id": "org-uuid-here",
    "amount_cents": 500
  }'
```

**Expected Result:**
- ❌ Should fail with HTTP 400
- ❌ Error: "Minimum payout amount is $10.00"

---

### 5. **Payout Audit Trail**

**Check Database:**
```sql
-- View recent payout requests
SELECT 
  context_type,
  context_id,
  requested_by,
  amount_cents,
  status,
  error_message,
  ip_address,
  created_at
FROM public.payout_requests_log
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Result:**
- ✅ Should see all payout attempts (success + failed)
- ✅ IP address and user agent should be captured
- ✅ Failed requests should have `error_message` populated

---

### 6. **Idempotency Keys**

**Test Duplicate Request:**
```bash
# Send same checkout request twice with same idempotency key
IDEMPOTENCY_KEY="test-$(date +%s)"

curl -X POST https://your-project.supabase.co/functions/v1/enhanced-checkout \
  -H "Authorization: Bearer $USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{
    "eventId": "event-id",
    "ticketSelections": [{"tierId": "tier-id", "quantity": 1}]
  }'

# Send again with same key
curl -X POST https://your-project.supabase.co/functions/v1/enhanced-checkout \
  -H "Authorization: Bearer $USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{
    "eventId": "event-id",
    "ticketSelections": [{"tierId": "tier-id", "quantity": 1}]
  }'
```

**Expected Result:**
- ✅ Both requests should return same `session_id`
- ✅ Only 1 Stripe session created
- ✅ Only 1 order record in database

---

## 📊 Database Health Checks

### Check Migration Applied:
```sql
-- Verify table exists
SELECT COUNT(*) FROM public.payout_requests_log;

-- Verify function exists
SELECT public.check_payout_rate_limit(
  'organization', 
  '00000000-0000-0000-0000-000000000000'::uuid
);
```

### Check RLS Policies:
```sql
-- View payout log policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'payout_requests_log';
```

**Expected Result:**
- ✅ Should see 3 SELECT policies:
  - `payout_requests_log_platform_admin_select`
  - `payout_requests_log_own_requests_select`
  - `payout_requests_log_org_admin_select`

---

## 🔍 Edge Function Logs

### Check for Errors:
```bash
# View recent logs for each function
supabase functions logs guest-checkout --tail 50
supabase functions logs enhanced-checkout --tail 50
supabase functions logs get-stripe-balance --tail 50
supabase functions logs create-payout --tail 50
```

**Look For:**
- ❌ Import errors (e.g., "Cannot find module '../_shared/pricing.ts'")
- ❌ Runtime errors in fee calculation
- ❌ Database permission errors on `payout_requests_log`

---

## 🎯 Success Criteria

All of these should be ✅:

- [ ] Guest checkout fee matches authenticated checkout fee
- [ ] Org admins/editors can view balance
- [ ] Rate limiting blocks 4th payout request within 1 hour
- [ ] Payouts below $10 are rejected
- [ ] All payout attempts are logged to database
- [ ] Duplicate checkout requests return same session
- [ ] No errors in Edge Function logs
- [ ] Database migration applied successfully

---

## 🐛 Troubleshooting

### "Cannot find module '../_shared/pricing.ts'"
**Fix:** Redeploy the functions (Supabase should bundle shared modules automatically)

### "Function check_payout_rate_limit does not exist"
**Fix:** Run the migration again: `supabase db push`

### "Table payout_requests_log does not exist"
**Fix:** Check migration was applied: `supabase db remote set` then `supabase db push`

### "Permission denied for table payout_requests_log"
**Fix:** Check RLS policies are enabled and grants are in place (see migration file)

---

## 📞 Support

If any tests fail:
1. Check Edge Function logs: `supabase functions logs <function-name>`
2. Check database logs: Supabase Dashboard → Database → Logs
3. Verify migration: `SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;`

---

**All tests passing?** 🎉 You're ready for Phase 2!

