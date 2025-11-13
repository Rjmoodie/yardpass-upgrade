# ✅ Pre-Deployment Verification Checklist

## 🔍 **VERIFY BEFORE DEPLOYING**

Never deploy directly to production without testing. Here's the proper order:

---

## **Step 1: Local Syntax Validation**

### **Check SQL Syntax Locally**

```bash
# Navigate to migration
cd "C:\Users\Louis Cid\Yardpass 3.0\liventix-upgrade"

# Validate SQL syntax (dry run)
supabase db lint
```

### **Or manually check for common errors:**

```bash
# Check for syntax errors in migration file
cat supabase/migrations/20251102000002_optimize_feed_for_ticket_purchases.sql | grep -i "error\|syntax\|invalid"
```

---

## **Step 2: Test on Local Supabase Instance**

### **Option A: Use Supabase Local Dev (Recommended)**

```bash
# Start local Supabase
supabase start

# Apply migration to LOCAL database
supabase db reset

# Check if migration succeeded
# Look for errors in output
```

### **Option B: Use Supabase Staging Project**

If you have a staging/dev project:

```bash
# Link to staging project
supabase link --project-ref YOUR_STAGING_PROJECT_REF

# Deploy to staging ONLY
supabase db push

# Test on staging first!
```

---

## **Step 3: Verify Tables Were Created**

After deploying to LOCAL/STAGING:

```sql
-- Check new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('ticket_detail_views', 'profile_visits', 'model_feature_weights');

-- Expected: 3 rows

-- Check columns
\d ticket_detail_views
\d profile_visits
\d model_feature_weights

-- Check indexes were created
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('ticket_detail_views', 'profile_visits');

-- Expected: multiple indexes
```

---

## **Step 4: Verify RLS Policies**

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('ticket_detail_views', 'profile_visits', 'model_feature_weights');

-- Expected: rowsecurity = true for first two

-- Check policies exist
SELECT tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename IN ('ticket_detail_views', 'profile_visits');

-- Expected: multiple policies (insert, select)
```

---

## **Step 5: Test Function Exists**

```sql
-- Check new function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%feed%';

-- Should include: get_home_feed_ids, get_home_feed_ranked

-- Test function signature
\df get_home_feed_ranked

-- Expected: shows function with 9 parameters (including new p_session_id)
```

---

## **Step 6: Smoke Test the Ranking Function**

```sql
-- Get a test user ID
SELECT id FROM auth.users LIMIT 1;

-- Test the ranking function (use real user ID)
SELECT 
  item_type,
  event_id,
  score::numeric(10,4) AS score
FROM get_home_feed_ranked(
  'YOUR_USER_ID_HERE'::uuid,
  10,  -- limit
  NULL,  -- cursor
  NULL,  -- categories
  40.7128,  -- lat (NYC)
  -74.0060,  -- lng
  NULL,  -- distance
  NULL,  -- date filters
  'test_session_123'  -- session_id
)
LIMIT 10;

-- Expected: Returns 10 rows with scores
-- If ERROR: read the error message carefully
```

---

## **Step 7: Test Insert Permissions**

```sql
-- Test ticket_detail_views insert (as authenticated user)
INSERT INTO ticket_detail_views (event_id, session_id) 
VALUES (
  (SELECT id FROM events LIMIT 1),  -- Pick a real event
  'test_session_' || now()::text
);

-- Expected: 1 row inserted

-- Verify it was inserted
SELECT COUNT(*) FROM ticket_detail_views WHERE session_id LIKE 'test_session_%';

-- Clean up test data
DELETE FROM ticket_detail_views WHERE session_id LIKE 'test_session_%';
```

---

## **Step 8: Check Feature Weights Were Seeded**

```sql
-- Verify weights table has data
SELECT COUNT(*) FROM model_feature_weights;

-- Expected: ~30 rows

-- View weights
SELECT feature, weight, half_life_days 
FROM model_feature_weights 
ORDER BY weight DESC 
LIMIT 10;

-- Expected: 
-- intent.saved: 5.0
-- intent.checkout_start: 4.0
-- intent.ticket_detail: 3.0
-- etc.
```

---

## **Step 9: Test Weight Updates**

```sql
-- Test updating weights (as service_role or authenticated with proper permissions)
UPDATE model_feature_weights 
SET weight = 5.5 
WHERE feature = 'intent.saved';

-- Verify update
SELECT weight FROM model_feature_weights WHERE feature = 'intent.saved';

-- Expected: 5.5

-- Reset
UPDATE model_feature_weights 
SET weight = 5.0 
WHERE feature = 'intent.saved';
```

---

## **Step 10: Performance Check**

```sql
-- Time the ranking function
EXPLAIN ANALYZE 
SELECT * FROM get_home_feed_ranked(
  'YOUR_USER_ID_HERE'::uuid,
  80,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL
);

-- Look for:
-- - Execution time < 1000ms (ideally < 500ms)
-- - No sequential scans on large tables
-- - Indexes being used

-- If slow, check:
SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
```

---

## **Step 11: Rollback Test**

```sql
-- Before deploying to production, know how to rollback

-- Option A: Drop new tables and restore old function
-- (Save old function definition first!)

-- Option B: Update weights to simulate old behavior
UPDATE model_feature_weights SET weight = 0.00 WHERE feature = 'component.purchase_intent';
UPDATE model_feature_weights SET weight = 0.60 WHERE feature = 'component.freshness';
UPDATE model_feature_weights SET weight = 0.25 WHERE feature = 'component.engagement';
UPDATE model_feature_weights SET weight = 0.15 WHERE feature = 'component.affinity';

-- Test old behavior is restored
```

---

## **Step 12: Edge Case Tests**

```sql
-- Test 1: New user with no history
SELECT * FROM get_home_feed_ranked(
  (SELECT id FROM auth.users ORDER BY created_at DESC LIMIT 1),  -- Newest user
  10, NULL, NULL, NULL, NULL, NULL, NULL, NULL
);
-- Expected: Returns results (cold start working)

-- Test 2: User with location
SELECT * FROM get_home_feed_ranked(
  'YOUR_USER_ID'::uuid,
  10, NULL, NULL,
  34.0522, -118.2437,  -- LA coordinates
  25.0,  -- 25 mile radius
  NULL, NULL, NULL
);
-- Expected: Only LA-area events

-- Test 3: Category filter
SELECT * FROM get_home_feed_ranked(
  'YOUR_USER_ID'::uuid,
  10, NULL,
  ARRAY['Music', 'Sports'],  -- Categories
  NULL, NULL, NULL, NULL, NULL
);
-- Expected: Only Music/Sports events

-- Test 4: Date filter
SELECT * FROM get_home_feed_ranked(
  'YOUR_USER_ID'::uuid,
  10, NULL, NULL, NULL, NULL, NULL,
  ARRAY['This Weekend'],  -- Date filter
  NULL
);
-- Expected: Only weekend events
```

---

## **Step 13: Data Integrity Checks**

```sql
-- Check for orphaned records (shouldn't exist due to CASCADE)
SELECT COUNT(*) FROM ticket_detail_views tdv
WHERE NOT EXISTS (SELECT 1 FROM events WHERE id = tdv.event_id);
-- Expected: 0

SELECT COUNT(*) FROM profile_visits pv
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = pv.visited_user_id);
-- Expected: 0

-- Check deduplication is working
SELECT user_id, event_id, hour_bucket, COUNT(*) 
FROM ticket_detail_views 
GROUP BY user_id, event_id, hour_bucket 
HAVING COUNT(*) > 1;
-- Expected: 0 rows (dedup working)
```

---

## **Step 14: Monitor Logs During Test**

```bash
# Watch Supabase logs in real-time
supabase functions logs --follow

# Or check PostgreSQL logs
# Look for:
# - No ERROR messages
# - No WARNING messages about missing indexes
# - Function execution times reasonable
```

---

## ✅ **Final Pre-Production Checklist**

Before `supabase db push` to production:

- [ ] ✅ SQL syntax validated (no errors)
- [ ] ✅ Migration tested on local/staging
- [ ] ✅ All tables created successfully
- [ ] ✅ All indexes created
- [ ] ✅ RLS policies active
- [ ] ✅ Function callable and returns results
- [ ] ✅ Permissions work (anon, authenticated)
- [ ] ✅ Feature weights seeded correctly
- [ ] ✅ Performance acceptable (<500ms)
- [ ] ✅ Edge cases handled (new users, filters)
- [ ] ✅ Deduplication working
- [ ] ✅ Rollback plan ready
- [ ] ✅ No errors in logs
- [ ] ✅ Backup of current database taken

---

## 🚨 **If ANY Test Fails**

**DO NOT DEPLOY TO PRODUCTION!**

1. Read error message carefully
2. Check migration file for typos
3. Verify table/column names match existing schema
4. Test fix on local/staging first
5. Re-run full checklist

---

## 📊 **After Production Deployment**

### **Immediate (First 10 minutes):**
```sql
-- 1. Verify migration applied
SELECT * FROM model_feature_weights LIMIT 5;

-- 2. Test function works in prod
SELECT COUNT(*) FROM get_home_feed_ranked(
  (SELECT id FROM auth.users LIMIT 1),
  10, NULL, NULL, NULL, NULL, NULL, NULL, NULL
);

-- 3. Check for errors
-- (View in Supabase Dashboard → Logs)
```

### **First Hour:**
```sql
-- Monitor tracking tables
SELECT COUNT(*) FROM ticket_detail_views WHERE viewed_at > now() - interval '1 hour';
SELECT COUNT(*) FROM profile_visits WHERE visited_at > now() - interval '1 hour';
```

### **First 24 Hours:**
```sql
-- Check signal coverage
SELECT 
  'ticket_views' AS signal,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(*) AS total_events
FROM ticket_detail_views 
WHERE viewed_at > now() - interval '24 hours'
UNION ALL
SELECT 
  'profile_visits',
  COUNT(DISTINCT visitor_id),
  COUNT(*)
FROM profile_visits 
WHERE visited_at > now() - interval '24 hours';

-- Monitor feed performance
-- (Check avg query time in Supabase Dashboard)
```

---

## 🎯 **UPDATED Deployment Flow**

### **CORRECT ORDER:**

1. ✅ **VERIFY** (Step 1-13 above)
2. ✅ **TEST** on local/staging
3. ✅ **BACKUP** production database
4. ✅ **DEPLOY** to production (`supabase db push`)
5. ✅ **MONITOR** (first 10min, 1hr, 24hr)
6. ✅ **INTEGRATE** frontend tracking
7. ✅ **VALIDATE** data flowing correctly
8. ✅ **TUNE** weights based on early data

---

## 🛠️ **Quick Local Test Script**

Save this as `test-migration.sh`:

```bash
#!/bin/bash

echo "🧪 Testing migration locally..."

# Start local Supabase
echo "Starting local Supabase..."
supabase start

# Reset DB with new migration
echo "Applying migration..."
supabase db reset

# Run verification queries
echo "Verifying tables..."
supabase db execute "SELECT COUNT(*) FROM model_feature_weights;"

echo "Testing function..."
supabase db execute "
  SELECT item_type, COUNT(*) 
  FROM get_home_feed_ranked(
    (SELECT id FROM auth.users LIMIT 1),
    10, NULL, NULL, NULL, NULL, NULL, NULL, NULL
  ) 
  GROUP BY item_type;
"

echo "✅ Local test complete! Check output above for errors."
```

Run with:
```bash
chmod +x test-migration.sh
./test-migration.sh
```

---

## 📋 **TL;DR - Safe Deployment Process**

```bash
# 1. TEST LOCALLY FIRST
supabase start
supabase db reset
# Check for errors ^^^

# 2. Run verification queries (see Step 3-13)

# 3. Test ranking function works

# 4. THEN deploy to production
supabase link --project-ref YOUR_PRODUCTION_REF
supabase db push

# 5. Immediately verify in production
# (Run Step 3-8 queries in production)

# 6. Monitor for 24 hours before full rollout
```

---

**You're absolutely right - verify FIRST, deploy AFTER! 🎯**

