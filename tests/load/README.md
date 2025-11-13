# 🧪 Liventix Load Testing Suite

Complete collection of ready-to-run load tests for all critical Liventix systems.

---

## 📋 Quick Start

### **Option 1: SQL Tests (Database Testing)**

Run these directly in **Supabase SQL Editor**:

1. Go to Supabase Dashboard → SQL Editor
2. Open the SQL file you want to run
3. Copy/paste the entire file into the editor
4. Click "Run" or press `Ctrl+Enter`
5. Review the output in the "Results" tab

### **Option 2: JavaScript Tests (Frontend/API Testing)**

Run these from your terminal:

```bash
# Install dependencies (one time)
npm install @supabase/supabase-js

# Run a test
node tests/load/frontend-ticketing-test.js
```

---

## 🗂️ Available Tests

| Test File | System | Type | Duration | Difficulty |
|-----------|--------|------|----------|------------|
| `1-ticketing-load-test.sql` | Ticketing & Checkout | SQL | ~5 min | ⭐ Easy |
| `2-feed-load-test.sql` | Unified Feed | SQL | ~3 min | ⭐ Easy |
| `3-search-load-test.sql` | Search & Discovery | SQL | ~4 min | ⭐ Easy |
| `4-credit-wallet-load-test.sql` | Credit/Wallet System | SQL | ~3 min | ⭐⭐ Medium |
| `frontend-ticketing-test.js` | Ticketing (Frontend) | JavaScript | ~5 min | ⭐⭐⭐ Advanced |

---

## 🎯 Test 1: Ticketing & Checkout

**File:** `1-ticketing-load-test.sql`

### What It Tests
- ✅ Single ticket reservation (baseline)
- ✅ Concurrent reservations (race conditions)
- ✅ Overselling prevention (critical)
- ✅ Hold expiration and release
- ✅ Performance benchmarking

### How to Run

1. **Open Supabase SQL Editor**
2. **Copy/paste the entire file**
3. **Update these values** (around line 70):
   ```sql
   v_tier_id uuid := 'YOUR_TIER_ID_HERE';
   ```
   
   💡 **To get your tier ID:**
   ```sql
   -- Run this first to get test event and tier
   SELECT e.id as event_id, e.title, tt.id as tier_id, tt.name
   FROM events e
   JOIN ticket_tiers tt ON tt.event_id = e.id
   WHERE e.title LIKE '[LOAD TEST]%'
   ORDER BY e.created_at DESC
   LIMIT 1;
   ```

4. **Click "Run"**

### Expected Output

```
🧪 TEST 1: Single Ticket Reservation
✅ Reservation successful
Available credits before: 50
Available credits after: 47

🧪 TEST 2: Concurrent Reservations (10 users)
  ✅ User 1 reserved 2 tickets
  ✅ User 2 reserved 2 tickets
  ...
Results: 10 successful, 0 failed

🧪 TEST 3: Overselling Prevention
✅ Correctly rejected: Insufficient inventory
Test PASSED if no overselling occurred!

✅ All ticketing load tests complete!
```

### Success Criteria

- ✅ No overselling under any scenario
- ✅ Reservation speed < 200ms
- ✅ Concurrent operations succeed
- ✅ Holds expire properly

---

## 🎯 Test 2: Unified Feed

**File:** `2-feed-load-test.sql`

### What It Tests
- ✅ Feed loading with 1000+ posts
- ✅ Infinite scroll pagination
- ✅ Reaction counting performance
- ✅ Post creation speed
- ✅ Complex queries with joins

### How to Run

1. **Open Supabase SQL Editor**
2. **Copy/paste the entire file**
3. **Click "Run"** (no configuration needed - it creates test data automatically)

### Expected Output

```
🚀 Setting up Feed Load Test...
Created 1000 posts
✅ Created 1000 posts

🧪 TEST 2: Infinite Scroll Performance
  Page 1: offset 0 (45.234 ms)
  Page 2: offset 20 (52.123 ms)
  ...
Average per page: 48 ms
Target: < 500ms per page

✅ All feed load tests complete!
```

### Success Criteria

- ✅ Initial load < 100ms (50 posts)
- ✅ Pagination < 500ms per page
- ✅ Reaction queries < 200ms
- ✅ Post creation < 100ms

---

## 🎯 Test 3: Search & Discovery

**File:** `3-search-load-test.sql`

### What It Tests
- ✅ Simple text search
- ✅ Multi-filter search (text + category + location + date)
- ✅ Location-based filtering
- ✅ Category filtering
- ✅ Pagination with large result sets
- ✅ Search ranking algorithm

### How to Run

1. **Open Supabase SQL Editor**
2. **Copy/paste the entire file**
3. **Click "Run"** (creates 500 diverse test events)

### Expected Output

```
🚀 Setting up Search Load Test...
  Created 100 events...
  Created 200 events...
  ...
✅ Created 500 events across 7 categories

🧪 TEST 1: Simple Text Search ("music festival")
Found 234 results in 00:00:00.234
Query time: 234 ms (Target: < 500ms)

🧪 TEST 2: Multi-Filter Search
Found 45 results in 00:00:00.567
Query time: 567 ms (Target: < 1000ms)

✅ All search load tests complete!
```

### Success Criteria

- ✅ Simple search < 500ms
- ✅ Multi-filter search < 1000ms
- ✅ Location search < 800ms
- ✅ Pagination < 500ms per page

---

## 🎯 Test 4: Credit/Wallet System

**File:** `4-credit-wallet-load-test.sql`

### What It Tests
- ✅ FIFO credit deduction
- ✅ Multi-lot deduction spanning
- ✅ Concurrent spending (race conditions)
- ✅ Insufficient funds handling
- ✅ Performance benchmarking
- ✅ Lot expiration handling

### How to Run

1. **Open Supabase SQL Editor**
2. **Copy/paste the entire file**
3. **Click "Run"** (creates test wallet and credit lots)

### Expected Output

```
🚀 Setting up Credit/Wallet Load Test...
✅ Created test wallet with 4 credit lots
Total credits: 2450

🧪 TEST 1: Basic FIFO Deduction (spend 100 credits)
  Deducted 100 credits from lot abc123
✅ Correct: Deducted exactly 100 credits

🧪 TEST 3: Concurrent Deductions (50 × 10 credits)
Available credits before: 2350
Total deducted: 500
Available credits after: 1850
✅ Balance is correct - no race conditions!

✅ All credit/wallet load tests complete!
```

### Success Criteria

- ✅ FIFO deduction working correctly
- ✅ No race conditions in concurrent spending
- ✅ Deduction speed < 100ms
- ✅ Balance consistency maintained

---

## 🎯 Test 5: Frontend Ticketing (Advanced)

**File:** `frontend-ticketing-test.js`

### What It Tests
- ✅ End-to-end checkout flow from frontend
- ✅ Concurrent user purchases
- ✅ Overselling prevention from API
- ✅ Authentication integration
- ✅ Real-world API performance

### Prerequisites

```bash
# Install dependencies
npm install @supabase/supabase-js
```

### Configuration

Edit `frontend-ticketing-test.js` and update:

```javascript
const config = {
  supabaseUrl: 'YOUR_SUPABASE_URL',          // From .env
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY', // From .env
  testEventId: 'YOUR_TEST_EVENT_ID',         // Get from SQL query
  testTierId: 'YOUR_TEST_TIER_ID',           // Get from SQL query
  
  concurrentUsers: 20,
  ticketsPerUser: 2,
  totalAvailable: 50,
};
```

💡 **Get test IDs with this SQL:**

```sql
-- Get test event
SELECT id, title 
FROM events 
WHERE title LIKE '[LOAD TEST]%' 
ORDER BY created_at DESC 
LIMIT 1;

-- Get tier for that event
SELECT id, name, quantity 
FROM ticket_tiers 
WHERE event_id = 'YOUR_EVENT_ID';
```

### How to Run

```bash
# Run all tests
node tests/load/frontend-ticketing-test.js

# Or run individual tests (edit file to uncomment)
```

### Expected Output

```
╔═══════════════════════════════════════════════════╗
║   Liventix Frontend Ticketing Load Test Suite    ║
╚═══════════════════════════════════════════════════╝

🧪 TEST 1: Sequential Purchase (Baseline Performance)
👤 User 1: Initiating checkout for 2 tickets...
✅ User 1: Checkout successful! (342ms)
   Duration: 342ms
   Target: < 500ms

🧪 TEST 2: Concurrent Purchase (Race Condition Test)
🚀 Creating 20 users...
✅ Created 20 test users
⏱️  Starting concurrent checkout...
👤 User 1: Initiating checkout for 2 tickets...
👤 User 2: Initiating checkout for 2 tickets...
...
📈 Test 2 Results:
   Successful Checkouts: 20/20
   Average Duration: 456ms
   ✅ Inventory matches expectations!

╔═══════════════════════════════════════════════════╗
║           ✅ All Tests Complete!                  ║
╚═══════════════════════════════════════════════════╝
```

### Success Criteria

- ✅ All authenticated requests succeed
- ✅ Checkout time < 500ms
- ✅ No overselling in concurrent tests
- ✅ Proper error handling

---

## 🛠️ Troubleshooting

### Issue: "No users found"

**Solution:**
```sql
-- Create a test user in Supabase Auth Dashboard or run:
SELECT id, email FROM auth.users LIMIT 1;
```

### Issue: SQL syntax errors

**Solution:**
- Make sure you're using PostgreSQL 14+
- Check that all required functions exist
- Run schema migrations first

### Issue: Permission denied

**Solution:**
```sql
-- Make sure you're running as service role in SQL Editor
-- Or check RLS policies
```

### Issue: "Tier not found" in JavaScript tests

**Solution:**
```javascript
// Run this SQL to find your test event/tier IDs:
SELECT e.id as event_id, tt.id as tier_id, tt.name
FROM events e
JOIN ticket_tiers tt ON tt.event_id = e.id
WHERE e.title LIKE '[LOAD TEST]%'
ORDER BY e.created_at DESC;

// Copy the IDs into your config
```

---

## 📊 Interpreting Results

### Performance Targets

| Operation | Target | Critical Threshold |
|-----------|--------|-------------------|
| Ticket Reservation | < 200ms | < 500ms |
| Checkout Session | < 500ms | < 1s |
| Feed Load (50 posts) | < 100ms | < 300ms |
| Search Query | < 500ms | < 1s |
| Credit Deduction | < 100ms | < 300ms |

### Health Indicators

**🟢 Healthy:**
- All tests pass
- Performance within targets
- No database errors
- Consistent results across runs

**🟡 Warning:**
- Some tests near critical threshold
- Occasional timeout errors
- Inconsistent performance

**🔴 Critical:**
- Tests failing consistently
- Overselling occurring
- Race conditions detected
- Database deadlocks

---

## 🔄 Cleanup

After testing, clean up test data:

```sql
-- Clean up ticketing test data
DELETE FROM ticket_holds WHERE session_id LIKE 'test-%';
DELETE FROM ticket_tiers WHERE event_id IN (
  SELECT id FROM events WHERE title LIKE '[LOAD TEST]%'
);
DELETE FROM events WHERE title LIKE '[LOAD TEST]%';

-- Clean up feed test data
DELETE FROM post_reactions WHERE post_id IN (
  SELECT id FROM event_posts WHERE event_id IN (
    SELECT id FROM events WHERE title LIKE '[LOAD TEST] Feed%'
  )
);
DELETE FROM event_posts WHERE event_id IN (
  SELECT id FROM events WHERE title LIKE '[LOAD TEST] Feed%'
);
DELETE FROM events WHERE title LIKE '[LOAD TEST] Feed%';

-- Clean up search test data
DELETE FROM events WHERE title LIKE '%Music Festival%' 
  AND created_at > now() - interval '1 day';

-- Clean up credit/wallet test data
DELETE FROM credit_lots WHERE created_at > now() - interval '1 day';
```

---

## 📝 Best Practices

1. **Always test in staging first** - Never run load tests on production
2. **Clean up after testing** - Use the cleanup scripts above
3. **Monitor database** - Watch for slow queries in Supabase Dashboard
4. **Test incrementally** - Start with small numbers, scale up
5. **Document results** - Keep track of performance over time
6. **Test edge cases** - Try boundary conditions (0 tickets, max capacity, etc.)

---

## 🚀 Next Steps

After running these tests:

1. ✅ Review all results and document performance
2. ✅ Fix any failures or performance issues
3. ✅ Re-run tests to verify fixes
4. ✅ Set up continuous testing (run before each deployment)
5. ✅ Monitor production metrics after launch

---

**Happy Testing! 🎉**



