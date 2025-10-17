# ⚡ Load Testing Quick Start

**3-step guide to production-grade testing**

---

## 🎯 You're Right - Let's Do This Properly!

Your observation is **100% correct**:
- ❌ `DO $$ ... $$` blocks = Sequential execution (not true concurrency)
- ❌ Counter-based models = Risk of race conditions
- ❌ No real lock contention = False confidence

**Here's the proper approach:**

---

## 🏃 Quick Start (3 Steps)

### **Step 1: Add Safety (2 minutes)**

Run in Supabase SQL Editor:
```sql
-- Copy/paste: tests/load/add-safety-constraints.sql
```

This adds:
- ✅ Unique indexes to prevent duplicates
- ✅ Check constraints to prevent overselling
- ✅ Performance indexes for fast queries

### **Step 2: True Concurrency Test (5 minutes)**

```bash
# A. Setup test data (run in Supabase SQL Editor)
# Copy/paste: tests/load/race-condition-test.sql

# B. Get your connection string
# Supabase Dashboard → Settings → Database → Connection String (Session mode)

# C. Run pgbench (50 concurrent sessions fighting for 10 tickets)
pgbench \
  -f tests/load/pgbench-reserve.sql \
  -c 50 \
  -j 10 \
  -T 30 \
  -r \
  "postgresql://postgres.xxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

# D. Verify no overselling (run in Supabase SQL Editor)
# Run the invariant checks from race-condition-test.sql
```

### **Step 3: API Load Test (Optional but Recommended)**

```bash
# Install k6
brew install k6  # macOS
# or: choco install k6  # Windows

# Run load test
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_ANON_KEY=xxx \
EVENT_ID=xxx \
TIER_ID=xxx \
k6 run tests/load/k6-load-test.js
```

---

## 📊 What Each Test Does

| Test | Type | Concurrency | What It Proves | Time |
|------|------|-------------|----------------|------|
| `1-ticketing-load-test.sql` | Functional | ❌ No | Logic works | 30s |
| `pgbench-reserve.sql` | Database | ✅ YES | No race conditions | 30s |
| `k6-load-test.js` | API/HTTP | ✅ YES | Full stack performance | 70s |

---

## ✅ Success Criteria

After running all tests:

**Database Level (pgbench):**
- ✅ Total successful reservations ≤ available tickets
- ✅ No constraint violations
- ✅ All 5 invariant checks pass
- ✅ p99 latency < 1s

**API Level (k6):**
- ✅ p90 < 500ms
- ✅ p99 < 1000ms
- ✅ Failure rate < 5% (excluding sold-out)
- ✅ No 500 errors

---

## 🚨 What to Watch For

### **Database Issues**
```bash
# Check for these in pgbench output:
❌ "deadlock detected"
❌ "could not serialize access"
❌ Successful transactions > available tickets
❌ Average latency > 1000ms
```

### **API Issues**
```bash
# Check for these in k6 output:
❌ http_req_failed > 10%
❌ p99 > 2000ms
❌ oversell_detected > 0
❌ 500 Internal Server Error
```

---

## 📝 Files Created

```
tests/load/
├── add-safety-constraints.sql      # 🛡️  Run FIRST (adds constraints)
├── race-condition-test.sql         # 🧪 Setup for pgbench testing
├── pgbench-reserve.sql             # 🏃 pgbench script (true concurrency)
├── k6-load-test.js                 # 🚀 k6 API load test
└── ADVANCED_TESTING_GUIDE.md       # 📖 Complete guide
```

---

## 🎯 Recommended Testing Order

**Before TestFlight:**
1. ✅ Run `add-safety-constraints.sql` (one time)
2. ✅ Run pgbench test (proves no race conditions)
3. ✅ Verify all invariants pass
4. ⚠️  Run k6 test (nice to have)

**Minimum for Production:**
- **MUST PASS**: pgbench with 50 clients, no overselling
- **MUST PASS**: All 5 invariant checks
- **SHOULD PASS**: k6 with p99 < 1s

---

## 💡 Pro Tips

1. **Test with realistic capacity** - 10-50 tickets forces contention
2. **Monitor during test** - Watch Supabase Dashboard → Database → Query Performance
3. **Save results** - Document baseline performance
4. **Test edge cases** - Max capacity, sold out, expired holds
5. **Automate** - Add to CI/CD for regression testing

---

## 🏆 Bottom Line

Your original tests = **Functional verification** ✅  
These new tests = **Race-proof validation** 🔥

**Both are important!**
- Use functional tests for quick checks
- Use concurrency tests before production deploys

---

**Ready to run true load tests? Start with Step 1!** 🚀


