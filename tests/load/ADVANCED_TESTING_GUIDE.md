# 🏆 Liventix Advanced Load Testing Guide

**True concurrency, race condition testing, and production-grade performance validation.**

---

## 🎯 Why Advanced Testing Matters

Your initial tests (`1-ticketing-load-test.sql`) are **functional checks** - they verify logic works in isolation. But they don't test:

- ❌ **Real concurrency** - All operations run sequentially in one session
- ❌ **Race conditions** - No actual lock contention or transaction conflicts
- ❌ **Performance percentiles** - Only mean latency, not p50/p90/p99
- ❌ **Error taxonomy** - Can't distinguish overselling vs legitimate sold-out

This guide fixes all of that.

---

## 🔧 Critical Database Improvements

### **1. Add Safety Indexes**

Run this in Supabase SQL Editor first:

```sql
-- Prevent duplicate active holds per session/tier
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_hold_session_tier
ON ticket_holds (session_id, tier_id)
WHERE status = 'active' AND session_id IS NOT NULL;

-- Fast lookup for active holds by tier
CREATE INDEX IF NOT EXISTS idx_ticket_holds_tier_active
ON ticket_holds (tier_id)
WHERE status = 'active';

-- Expired holds cleanup (for cron job)
CREATE INDEX IF NOT EXISTS idx_ticket_holds_expiry
ON ticket_holds (expires_at)
WHERE status = 'active';

-- Ticket tiers by event
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event
ON ticket_tiers (event_id);
```

### **2. Add Invariant Constraints**

```sql
-- Prevent overselling at database level
ALTER TABLE ticket_tiers
ADD CONSTRAINT check_no_negative_availability
CHECK (
  (total_quantity - COALESCE(sold_quantity, 0) - COALESCE(reserved_quantity, 0)) >= 0
);

-- Prevent over-reservation
ALTER TABLE ticket_tiers
ADD CONSTRAINT check_reserved_lte_total
CHECK (reserved_quantity <= total_quantity);

-- Prevent over-sold
ALTER TABLE ticket_tiers
ADD CONSTRAINT check_sold_lte_total
CHECK (sold_quantity <= total_quantity);
```

---

## 🧪 Testing Approach: 3 Levels

### **Level 1: SQL Functional Tests** ✅ (What you already have)
- Quick smoke tests
- Verify basic logic
- Single-session execution
- **Good for:** CI/CD, pre-deployment checks

### **Level 2: pgbench Concurrency Tests** 🔥 (New - True race testing)
- Multi-session, true concurrent access
- Database-level stress testing
- Tests transaction isolation
- **Good for:** Database race conditions, lock contention

### **Level 3: k6 API Load Tests** 🚀 (New - Production simulation)
- Full HTTP stack testing
- Realistic user behavior
- Percentile latency (p50/p90/p99)
- **Good for:** End-to-end performance, production readiness

---

## 📋 **Level 2: pgbench Testing (DATABASE CONCURRENCY)**

### **Setup**

1. **Run `tests/load/race-condition-test.sql` in Supabase SQL Editor**
   - Creates test event with only 10 tickets (forces contention)
   - Sets up invariant checks
   - Adds performance indexes

2. **Copy the Tier ID** from the output

3. **Update `tests/load/pgbench-reserve.sql`**
   ```sql
   \set tier_id 'YOUR_ACTUAL_TIER_ID'
   ```

### **Run pgbench**

```bash
# Basic test: 50 concurrent sessions for 30 seconds
pgbench \
  -f tests/load/pgbench-reserve.sql \
  -n \
  -c 50 \
  -j 10 \
  -T 30 \
  -r \
  postgresql://postgres:password@db.project.supabase.co:5432/postgres

# Flags explained:
# -f   = Script file to run
# -n   = No vacuum (faster)
# -c   = Number of concurrent clients (sessions)
# -j   = Number of worker threads
# -T   = Duration in seconds
# -r   = Report per-statement latency
```

### **Expected Output**

```
transaction type: Custom query
scaling factor: 1
query mode: simple
number of clients: 50
number of threads: 10
duration: 30 s
number of transactions actually processed: 234
latency average = 645.234 ms
latency stddev = 123.456 ms
tps = 7.800000 (including connections establishing)
tps = 7.850000 (excluding connections establishing)

statement latencies in milliseconds:
         645.234  SELECT reserve_tickets_batch(...)
```

### **Interpret Results**

✅ **Good Signs:**
- TPS (transactions per second) > 5
- Latency average < 1000ms
- Total successful transactions ≤ total available tickets
- All invariant checks pass

🔴 **Red Flags:**
- More transactions succeed than tickets available (OVERSELLING!)
- Database errors: deadlock, serialization failure
- Latency > 2000ms
- Invariant checks fail

### **Verify After Test**

Run the invariant checks in `race-condition-test.sql`:

```sql
-- Should all return ✅
-- Check 1: No negative availability
-- Check 2: Reserved ≤ total
-- Check 3: Sold ≤ total
-- Check 4: Hold sums match reserved_quantity
-- Check 5: No duplicate tickets
```

---

## 📋 **Level 3: k6 Testing (HTTP API LOAD)**

### **Setup**

1. **Install k6**
   ```bash
   # macOS
   brew install k6
   
   # Windows
   choco install k6
   
   # Linux
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Set environment variables**
   ```bash
   export SUPABASE_URL="https://yieslxnrfeqchbcmgavz.supabase.co"
   export SUPABASE_ANON_KEY="your-anon-key"
   export EVENT_ID="your-event-id"
   export TIER_ID="your-tier-id"
   ```

3. **Run k6 test**
   ```bash
   k6 run tests/load/k6-load-test.js
   ```

### **Expected Output**

```
          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     (   /   ‾‾\  
   /          \   |  |\  \ |  (‾)  | 
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: tests/load/k6-load-test.js
     output: -

  scenarios: (100.00%) 1 scenario, 100 max VUs, 1m10s max duration
           * default: Up to 100 looping VUs for 1m10s over 4 stages

running (1m10s), 000/100 VUs, 1234 complete and 0 interrupted iterations

✓ reserve: status 200 or 409
✓ reserve: has session_url or error

█ Ticket Reservation Flow

  █ http_reqs......................: 2468   35.257143/s
  █ http_req_duration...............: avg=342ms p(90)=456ms p(99)=789ms
  █ reserve_latency.................: avg=345ms p(90)=458ms p(99)=792ms
  █ reserve_failures................: 2.34%
  █ oversell_detected...............: 0

═══════════════════════════════════════════════
          K6 LOAD TEST SUMMARY
═══════════════════════════════════════════════

📊 HTTP Performance:
  Requests: 2468
  Failed: 2.34%
  Duration p50: 298.45ms
  Duration p90: 456.78ms
  Duration p99: 789.12ms

🎫 Reservation Metrics:
  Reserve Failures: 2.34%
  Reserve p50: 301.23ms
  Reserve p90: 458.90ms
  Reserve p99: 792.45ms

✅ Threshold Results:
  ✅ http_req_duration: p(90)<500: 2468/2468
  ✅ reserve_failures: rate<0.05: PASS
```

### **Success Criteria**

✅ **Performance Targets:**
- p90 latency < 500ms
- p99 latency < 1000ms
- Failure rate < 5% (excluding legitimate sold-out)

✅ **Safety Checks:**
- No overselling detected (`oversell_detected = 0`)
- All database invariants pass
- No 500 errors (internal server errors)

---

## 🔬 Advanced: SERIALIZABLE Isolation Testing

### **Why It Matters**

Default PostgreSQL isolation (`READ COMMITTED`) can allow anomalies under high concurrency. `SERIALIZABLE` prevents all anomalies but requires retry logic.

### **Test It**

```sql
-- Add to your reserve function
BEGIN;
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Your existing reserve logic...

COMMIT;

EXCEPTION 
  WHEN SQLSTATE '40001' THEN 
    -- Serialization failure - retry in app code
    RAISE NOTICE 'Serialization failure - retry needed';
```

### **pgbench with SERIALIZABLE**

```sql
-- pgbench-serializable.sql
BEGIN ISOLATION LEVEL SERIALIZABLE;

SELECT reserve_tickets_batch(...);

COMMIT;
```

Run and monitor for `40001` errors:
```bash
pgbench -f pgbench-serializable.sql -c 100 -j 20 -T 60 -r <db>
```

Expected: Some transactions will abort with serialization failures. Your app should retry.

---

## 📊 Metrics You Should Track

### **Latency Percentiles**

| Metric | p50 Target | p90 Target | p99 Target | p99.9 Target |
|--------|------------|------------|------------|--------------|
| Reserve | < 200ms | < 400ms | < 800ms | < 2s |
| Checkout | < 500ms | < 1s | < 2s | < 5s |
| Payment | < 2s | < 4s | < 8s | < 15s |

### **Error Taxonomy**

| Error Code | Meaning | Expected Rate | Action |
|------------|---------|---------------|--------|
| `40001` | Serialization failure | < 5% | Retry |
| `23505` | Duplicate (idempotency) | Any | Return cached |
| `INSUFFICIENT_INVENTORY` | Sold out | High when full | Show sold out |
| `HOLD_EXPIRED` | Session timeout | < 10% | Offer recovery |
| `500` | Internal error | < 0.1% | Alert + fix |

### **Capacity Metrics**

- **Inventory utilization**: `sold + reserved / total`
- **Hold expiration rate**: Expired holds per minute
- **Conversion rate**: Completed purchases / reservations
- **Cart abandonment**: Expired holds / total holds

---

## 🚨 What to Watch For

### **Database Red Flags**

```sql
-- Check for slow queries
SELECT 
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE query LIKE '%reserve_tickets%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check for lock contention
SELECT 
  pid,
  wait_event_type,
  wait_event,
  state,
  query
FROM pg_stat_activity
WHERE wait_event IS NOT NULL
AND state = 'active';

-- Check for deadlocks (need to enable log_lock_waits)
-- Look in Supabase logs for "deadlock detected"
```

### **Application Red Flags**

- 🔴 More tickets sold than available (overselling)
- 🔴 Duplicate QR codes generated
- 🔴 Race conditions in balance/inventory updates
- 🔴 Memory leaks during sustained load
- 🔴 Connection pool exhaustion

---

## 📝 Complete Testing Workflow

### **Before TestFlight:**

```bash
# 1. Run functional tests (quick sanity check)
# Copy/paste tests/load/1-ticketing-load-test.sql into Supabase SQL Editor

# 2. Run database concurrency test
# a) Run tests/load/race-condition-test.sql (setup)
# b) Update tier ID in pgbench-reserve.sql
# c) Run pgbench
pgbench -f tests/load/pgbench-reserve.sql -c 50 -T 30 postgresql://...

# 3. Verify invariants (in Supabase SQL Editor)
# Run the invariant checks from race-condition-test.sql

# 4. Run API load test
k6 run tests/load/k6-load-test.js

# 5. Review all metrics and fix any failures
```

### **Continuous Testing:**

- Run Level 1 tests on every PR
- Run Level 2 tests weekly
- Run Level 3 tests before major releases
- Monitor production metrics daily

---

## 🎯 Quick Wins You Should Implement

### **1. Idempotency**

Add to your Edge Functions:

```typescript
// Check idempotency key
const idempotencyKey = req.headers.get('Idempotency-Key');
if (idempotencyKey) {
  const { data: existing } = await supabase
    .from('idempotency_keys')
    .select('response')
    .eq('key', idempotencyKey)
    .eq('user_id', user.id)
    .single();
  
  if (existing) {
    return new Response(JSON.stringify(existing.response), {
      status: 200,
      headers: { 'X-Idempotent-Replay': 'true' }
    });
  }
}

// ... do work ...

// Store result
await supabase.from('idempotency_keys').insert({
  key: idempotencyKey,
  user_id: user.id,
  response: result
});
```

### **2. Retry Logic**

Add to your frontend:

```typescript
async function reserveWithRetry(payload, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await supabase.functions.invoke('enhanced-checkout', {
        body: payload
      });
      
      return result;
      
    } catch (error) {
      // Retry on serialization failures or 503
      if (
        error.message?.includes('40001') || 
        error.message?.includes('serialization') ||
        error.status === 503
      ) {
        if (attempt < maxRetries) {
          const backoff = Math.min(100 * Math.pow(2, attempt), 1000);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }
      }
      
      throw error;
    }
  }
}
```

### **3. Hold Cleanup Cron**

Add to Supabase (via Dashboard → Database → Cron Jobs or pg_cron extension):

```sql
-- Run every minute
SELECT cron.schedule(
  'cleanup-expired-holds',
  '* * * * *',
  $$
    -- Mark holds as expired
    UPDATE ticket_holds
    SET status = 'expired'
    WHERE status = 'active' 
    AND expires_at < now();
    
    -- Recalculate reserved quantities
    UPDATE ticket_tiers tt
    SET reserved_quantity = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM ticket_holds
      WHERE tier_id = tt.id AND status = 'active'
    )
    WHERE id IN (
      SELECT DISTINCT tier_id 
      FROM ticket_holds 
      WHERE status = 'expired' 
      AND updated_at > now() - interval '2 minutes'
    );
  $$
);
```

---

## 📈 Performance Benchmarking

### **Baseline Targets**

| Operation | p50 | p90 | p99 | Acceptable Failure Rate |
|-----------|-----|-----|-----|------------------------|
| Reserve (no contention) | 150ms | 300ms | 600ms | < 1% |
| Reserve (high contention) | 300ms | 600ms | 1200ms | < 10% |
| Checkout | 400ms | 800ms | 1500ms | < 2% |
| Payment webhook | 1000ms | 2000ms | 4000ms | < 0.1% |

### **Load Profiles**

**Light Load (Normal Day):**
```bash
k6 run --vus 10 --duration 5m tests/load/k6-load-test.js
```

**Medium Load (Popular Event):**
```bash
k6 run --vus 50 --duration 3m tests/load/k6-load-test.js
```

**Stress Test (Viral Event / Flash Sale):**
```bash
k6 run --vus 200 --duration 2m tests/load/k6-load-test.js
```

**Spike Test (Ticket Drop):**
```bash
k6 run --stage 0s:0,10s:500,30s:500,10s:0 tests/load/k6-load-test.js
```

---

## 🔍 Observability Setup

### **Supabase Dashboard**

Monitor in real-time during tests:
1. **Database** → **Query Performance**
   - Watch for slow queries > 1s
   - Look for lock waits
   
2. **Logs** → **Functions**
   - Check for errors
   - Monitor invocation counts

3. **Database** → **Roles & Connections**
   - Watch connection pool usage
   - Alert if connections > 80% capacity

### **Custom Metrics Query**

```sql
-- Run this during/after load test
SELECT 
  schemaname,
  tablename,
  seq_scan as "Sequential Scans",
  idx_scan as "Index Scans",
  n_tup_ins as "Inserts",
  n_tup_upd as "Updates",
  n_tup_del as "Deletes"
FROM pg_stat_user_tables
WHERE tablename IN ('ticket_holds', 'ticket_tiers', 'orders', 'tickets')
ORDER BY n_tup_upd + n_tup_ins DESC;
```

---

## ✅ Production Readiness Checklist

Before declaring your system "race-proof":

- [ ] Unique indexes prevent duplicate holds
- [ ] Database constraints prevent overselling
- [ ] pgbench test with 100 clients shows no overselling
- [ ] k6 test with 200 VUs shows p99 < 1s
- [ ] All 5 invariant checks pass
- [ ] Retry logic handles serialization failures
- [ ] Idempotency keys prevent duplicate operations
- [ ] Hold cleanup cron job is running
- [ ] Monitoring/alerts are set up
- [ ] Load test results documented

---

## 🚀 Quick Start

```bash
# 1. Setup (run in Supabase SQL Editor)
# Copy/paste: tests/load/race-condition-test.sql

# 2. Get connection string from Supabase
# Settings → Database → Connection String (Session mode)

# 3. Run pgbench concurrency test
pgbench -f tests/load/pgbench-reserve.sql \
  -c 50 -j 10 -T 30 -r \
  "postgresql://postgres.xxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

# 4. Run k6 API load test
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_ANON_KEY=xxx \
EVENT_ID=xxx \
TIER_ID=xxx \
k6 run tests/load/k6-load-test.js

# 5. Verify (run in Supabase SQL Editor)
# Run the invariant checks from race-condition-test.sql
```

---

## 📚 Additional Resources

- **pgbench Documentation**: https://www.postgresql.org/docs/current/pgbench.html
- **k6 Documentation**: https://k6.io/docs/
- **PostgreSQL Isolation Levels**: https://www.postgresql.org/docs/current/transaction-iso.html
- **Supabase Connection Pooling**: https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pool

---

**You're now equipped for production-grade load testing!** 🏆



