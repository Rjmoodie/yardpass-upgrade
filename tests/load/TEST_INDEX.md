# 🧪 YardPass Load Testing - Complete Index

**Quick Reference:** All available load tests at a glance.

---

## 📁 Test Files Overview

```
tests/load/
├── README.md                        # 📖 Complete testing guide
├── TEST_INDEX.md                    # 📋 This file (quick reference)
│
├── 1-ticketing-load-test.sql       # 🎫 Ticketing & Checkout
├── 2-feed-load-test.sql            # 📱 Unified Feed
├── 3-search-load-test.sql          # 🔍 Search & Discovery
├── 4-credit-wallet-load-test.sql   # 💰 Credit/Wallet System
└── frontend-ticketing-test.js      # 🌐 Frontend E2E Testing
```

---

## ⚡ Quick Start Commands

### **SQL Tests (Run in Supabase SQL Editor)**

```sql
-- Copy/paste one of these files into Supabase SQL Editor:
-- 1. tests/load/1-ticketing-load-test.sql
-- 2. tests/load/2-feed-load-test.sql
-- 3. tests/load/3-search-load-test.sql
-- 4. tests/load/4-credit-wallet-load-test.sql

-- Then click "Run" or press Ctrl+Enter
```

### **JavaScript Tests (Run in Terminal)**

```bash
# Install dependencies (one time)
npm install @supabase/supabase-js

# Update config in test file first, then run:
node tests/load/frontend-ticketing-test.js
```

---

## 🎯 Test Matrix

| # | Test Name | System | Priority | Time | Targets |
|---|-----------|--------|----------|------|---------|
| **1** | Ticketing Load Test | Checkout & Inventory | 🔴 Critical | 5min | < 200ms reservation, no overselling |
| **2** | Feed Load Test | Posts & Reactions | 🔴 Critical | 3min | < 100ms feed load, 60fps scroll |
| **3** | Search Load Test | Discovery & Filtering | 🔴 Critical | 4min | < 500ms search, proper ranking |
| **4** | Credit Wallet Test | FIFO Deduction | 🟡 High | 3min | < 100ms deduction, no race conditions |
| **5** | Frontend E2E Test | Full Checkout Flow | 🟡 High | 5min | < 500ms API, auth working |

---

## 📊 What Each Test Covers

### 1️⃣ Ticketing Load Test (`1-ticketing-load-test.sql`)

**Tests:**
- ✅ Single ticket reservation (baseline)
- ✅ 10 concurrent users buying tickets
- ✅ Overselling prevention (buying more than available)
- ✅ Hold expiration after 10 minutes
- ✅ Performance benchmark (100 reservations)

**Performance Targets:**
- Reservation: < 200ms
- No overselling ever
- Concurrent ops succeed

**SQL To Run First:**
```sql
-- Get test event and tier IDs
SELECT e.id as event_id, e.title, tt.id as tier_id, tt.name, tt.quantity
FROM events e
JOIN ticket_tiers tt ON tt.event_id = e.id
WHERE e.title LIKE '[LOAD TEST]%'
ORDER BY e.created_at DESC LIMIT 1;
```

---

### 2️⃣ Feed Load Test (`2-feed-load-test.sql`)

**Tests:**
- ✅ Feed load with 1000 posts
- ✅ Infinite scroll (10 pages)
- ✅ 100 posts with 50 reactions each
- ✅ Complex queries with joins
- ✅ 50 concurrent post creations

**Performance Targets:**
- Initial load: < 100ms
- Pagination: < 500ms/page
- Reactions: < 200ms

**Auto-Creates:**
- 1000 test posts
- Test reactions
- Test comments

---

### 3️⃣ Search Load Test (`3-search-load-test.sql`)

**Tests:**
- ✅ Simple text search ("music festival")
- ✅ Multi-filter (text + category + location + date)
- ✅ Location filtering (4 cities)
- ✅ Category filtering (6 categories)
- ✅ Pagination (20 pages)
- ✅ Ranking algorithm

**Performance Targets:**
- Simple search: < 500ms
- Multi-filter: < 1000ms
- Location: < 800ms
- Category: < 300ms

**Auto-Creates:**
- 500 diverse events
- Various categories
- Multiple locations

---

### 4️⃣ Credit Wallet Test (`4-credit-wallet-load-test.sql`)

**Tests:**
- ✅ FIFO deduction (oldest first)
- ✅ Multi-lot spanning
- ✅ 50 concurrent deductions
- ✅ Insufficient funds handling
- ✅ 100 deduction performance benchmark
- ✅ Expired lot handling

**Performance Targets:**
- Deduction: < 100ms
- No race conditions
- Balance consistency

**Auto-Creates:**
- Test wallet
- 4 credit lots (different ages)
- Expiring credits

---

### 5️⃣ Frontend E2E Test (`frontend-ticketing-test.js`)

**Tests:**
- ✅ Sequential purchase (baseline)
- ✅ 20 concurrent users buying tickets
- ✅ Overselling from API layer
- ✅ Auth integration
- ✅ Real-world latency

**Performance Targets:**
- Checkout: < 500ms
- Auth: works properly
- No overselling

**Requires Configuration:**
```javascript
const config = {
  supabaseUrl: 'YOUR_URL',
  supabaseAnonKey: 'YOUR_KEY',
  testEventId: 'YOUR_EVENT_ID',
  testTierId: 'YOUR_TIER_ID',
};
```

---

## 🚦 Testing Workflow

### **Before TestFlight Upload**

1. ✅ Run Test #1 (Ticketing) - **MUST PASS**
2. ✅ Run Test #2 (Feed) - **MUST PASS**
3. ✅ Run Test #3 (Search) - **MUST PASS**
4. ⚠️ Run Test #4 (Credit Wallet) - Recommended
5. ⚠️ Run Test #5 (Frontend E2E) - Recommended

### **After Each Major Feature**

- Run relevant test suite
- Document results
- Fix any regressions
- Re-test

### **Continuous Monitoring**

- Set up alerts for slow queries
- Monitor Supabase Dashboard
- Track performance over time

---

## 📈 Success Criteria

### **All Tests Must:**

- ✅ Complete without errors
- ✅ Meet performance targets
- ✅ Show consistent results across multiple runs
- ✅ Handle edge cases properly

### **Critical Failures:**

- ❌ Overselling (tickets sold beyond capacity)
- ❌ Race conditions (duplicate records, wrong counts)
- ❌ Data inconsistency (balance mismatches)
- ❌ Database deadlocks
- ❌ Performance > 2× target threshold

---

## 🔧 Common Issues & Solutions

### **Issue: "No users found"**
```sql
-- Solution: Check auth.users table
SELECT id, email FROM auth.users LIMIT 1;
-- Or create test user in Supabase Auth Dashboard
```

### **Issue: "Function not found"**
```sql
-- Solution: Run migrations first
-- Check: supabase/migrations/*.sql
```

### **Issue: "Permission denied"**
```sql
-- Solution: Run in SQL Editor with service role
-- Or check RLS policies
```

### **Issue: Tests timeout**
```sql
-- Solution: Reduce test data volume
-- Change: v_event_count := 500 to v_event_count := 100
```

---

## 📝 Results Template

```
Date: _______________
Tester: _____________
Environment: Staging / Production

╔════════════════════════════════════════════════════╗
║          Test Results Summary                      ║
╚════════════════════════════════════════════════════╝

Test 1: Ticketing Load Test
Status: ✅ PASS / ❌ FAIL
Reservation Time: _____ ms (target: < 200ms)
Overselling: ✅ NO / ❌ YES
Notes: _______________________________________

Test 2: Feed Load Test
Status: ✅ PASS / ❌ FAIL
Feed Load: _____ ms (target: < 100ms)
Pagination: _____ ms (target: < 500ms)
Notes: _______________________________________

Test 3: Search Load Test
Status: ✅ PASS / ❌ FAIL
Simple Search: _____ ms (target: < 500ms)
Multi-Filter: _____ ms (target: < 1000ms)
Notes: _______________________________________

Test 4: Credit Wallet Test
Status: ✅ PASS / ❌ FAIL
Deduction: _____ ms (target: < 100ms)
Race Conditions: ✅ NO / ❌ YES
Notes: _______________________________________

Test 5: Frontend E2E Test
Status: ✅ PASS / ❌ FAIL
Checkout: _____ ms (target: < 500ms)
Auth: ✅ WORKING / ❌ BROKEN
Notes: _______________________________________

╔════════════════════════════════════════════════════╗
║          Overall: ✅ READY / ❌ NOT READY          ║
╚════════════════════════════════════════════════════╝
```

---

## 🔗 Related Documentation

- **[LOAD_TESTING_GUIDE.md](./LOAD_TESTING_GUIDE.md)** - Complete testing guide
- **[README.md](./README.md)** - Detailed test descriptions
- **[TICKET_PURCHASING_ECOSYSTEM.md](../../TICKET_PURCHASING_ECOSYSTEM.md)** - System architecture

---

## 🎯 Quick Decision Tree

```
Need to test ticketing? 
  → Run 1-ticketing-load-test.sql

Need to test feed performance?
  → Run 2-feed-load-test.sql

Need to test search?
  → Run 3-search-load-test.sql

Need to test credit system?
  → Run 4-credit-wallet-load-test.sql

Need to test full frontend flow?
  → Run frontend-ticketing-test.js

Need to test everything?
  → Run all 5 tests in order
```

---

**Ready to test? Start with the [README.md](./README.md) for detailed instructions!** 🚀


