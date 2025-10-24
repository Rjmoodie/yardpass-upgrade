# 🔥 pgbench & k6 Testing - Complete Setup Guide

**True concurrency testing for production validation**

---

## 🎯 Which Should You Use?

| Tool | Tests | Best For | Difficulty | Time |
|------|-------|----------|------------|------|
| **pgbench** | Database layer | Race conditions, locks, SQL performance | Medium | 15 min setup |
| **k6** | HTTP API layer | Full stack, realistic users, API latency | Easy | 5 min setup |

**Recommendation:** 
- **pgbench** = Best for database race-proofing
- **k6** = Best for overall performance validation

---

## 🔧 Option 1: pgbench (Database Concurrency)

### **What You Need**

1. **PostgreSQL client tools** (includes pgbench)
2. **Supabase database connection string**
3. **Tier ID from your race test**

### **Step 1: Install pgbench**

#### **Windows (PowerShell):**
```powershell
# Option A: Install PostgreSQL (includes pgbench)
# Download from: https://www.postgresql.org/download/windows/
# Choose "Download the installer" → Install PostgreSQL 16

# Option B: Use Chocolatey
choco install postgresql

# Verify installation
pgbench --version
# Should output: pgbench (PostgreSQL) 16.x
```

#### **macOS:**
```bash
# Using Homebrew
brew install postgresql@16

# Verify
pgbench --version
```

#### **Linux:**
```bash
sudo apt-get install postgresql-client
# or
sudo yum install postgresql

pgbench --version
```

### **Step 2: Get Your Database Connection String**

1. Go to **Supabase Dashboard**
2. **Settings** → **Database**
3. Under "Connection String", select **"Session mode"** (not Transaction mode)
4. Click **"Copy"**

**Format:**
```
postgresql://postgres.yieslxnrfeqchbcmgavz:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

⚠️ **Important:** Replace `[YOUR-PASSWORD]` with your actual database password.

### **Step 3: Get Your Test Tier ID**

Run this in Supabase SQL Editor:

```sql
SELECT tt.id as tier_id
FROM ticket_tiers tt
JOIN events e ON e.id = tt.event_id
WHERE e.title LIKE '[RACE TEST]%'
ORDER BY tt.created_at DESC
LIMIT 1;
```

**Copy the tier_id** (it's a UUID like `a1b2c3d4-...`)

### **Step 4: Update pgbench Script**

Edit `tests/load/pgbench-reserve.sql` line 17:

**Before:**
```sql
\set tier_id 'PASTE_YOUR_TIER_ID_HERE'
```

**After:**
```sql
\set tier_id 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
```

### **Step 5: Run pgbench Test**

Open **PowerShell** (or Terminal on Mac/Linux) and run:

```powershell
# Navigate to your project
cd "C:\Users\Louis Cid\Yardpass 3.0\yardpass-upgrade"

# Run pgbench
pgbench `
  -f tests/load/pgbench-reserve.sql `
  -n `
  -c 50 `
  -j 10 `
  -T 30 `
  -r `
  "postgresql://postgres.yieslxnrfeqchbcmgavz:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

**Parameters explained:**
- `-f` = Script file to run
- `-n` = No vacuum (faster)
- `-c 50` = **50 concurrent clients** (real sessions!)
- `-j 10` = 10 worker threads
- `-T 30` = Run for 30 seconds
- `-r` = Report latency details

### **Step 6: Interpret pgbench Results**

**Expected Output:**
```
pgbench (PostgreSQL) 16.1
transaction type: <builtin: select only>
scaling factor: 1
query mode: simple
number of clients: 50
number of threads: 10
duration: 30 s
number of transactions actually processed: 234
latency average = 645.234 ms
latency stddev = 123.456 ms
initial connection time = 234.567 ms
tps = 7.800000 (without initial connection time)

statement latencies in milliseconds:
         645.234  SELECT reserve_tickets_batch(...)
```

**What to look for:**

✅ **Good Signs:**
- `number of transactions actually processed` ≤ total available tickets
- `latency average` < 1000ms
- No error messages

❌ **Red Flags:**
- More transactions than available tickets = **OVERSELLING!**
- `ERROR: deadlock detected`
- `ERROR: could not serialize access`
- `latency average` > 2000ms

### **Step 7: Verify No Overselling**

Run this in Supabase SQL Editor:

```sql
-- Check final state
SELECT 
  tt.name,
  tt.total_quantity as total,
  tt.reserved_quantity as reserved,
  COUNT(DISTINCT th.id) as active_holds,
  CASE 
    WHEN tt.reserved_quantity > tt.total_quantity THEN '❌ OVERSOLD!'
    ELSE '✅ Safe'
  END as status
FROM ticket_tiers tt
LEFT JOIN ticket_holds th ON th.tier_id = tt.id AND th.status = 'active'
WHERE tt.id IN (
  SELECT tt2.id FROM ticket_tiers tt2
  JOIN events e ON e.id = tt2.event_id
  WHERE e.title LIKE '[RACE TEST]%'
)
GROUP BY tt.id, tt.name, tt.total_quantity, tt.reserved_quantity;
```

---

## 🚀 Option 2: k6 (API Load Testing)

### **What You Need**

1. **k6 installed** (lightweight, no PostgreSQL needed)
2. **Your Supabase credentials**
3. **Test event and tier IDs**

### **Step 1: Install k6**

#### **Windows (PowerShell as Administrator):**
```powershell
# Using Chocolatey
choco install k6

# Or using Winget
winget install k6 --source winget

# Verify
k6 version
```

#### **macOS:**
```bash
brew install k6

k6 version
```

#### **Linux:**
```bash
# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

k6 version
```

### **Step 2: Get Your Credentials**

You need 4 values:

1. **SUPABASE_URL** - From your `.env` file or Supabase Dashboard
   ```
   https://yieslxnrfeqchbcmgavz.supabase.co
   ```

2. **SUPABASE_ANON_KEY** - From your `.env` file or Supabase Dashboard → Settings → API
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **EVENT_ID** - Run this in SQL Editor:
   ```sql
   SELECT id FROM events WHERE title LIKE '[RACE TEST]%' ORDER BY created_at DESC LIMIT 1;
   ```

4. **TIER_ID** - Run this in SQL Editor:
   ```sql
   SELECT id FROM ticket_tiers WHERE event_id = 'YOUR_EVENT_ID' LIMIT 1;
   ```

### **Step 3: Run k6 Test**

#### **Windows PowerShell:**
```powershell
# Set environment variables
$env:SUPABASE_URL="https://yieslxnrfeqchbcmgavz.supabase.co"
$env:SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
$env:EVENT_ID="a1b2c3d4-..."
$env:TIER_ID="e5f6g7h8-..."

# Navigate to project
cd "C:\Users\Louis Cid\Yardpass 3.0\yardpass-upgrade"

# Run k6
k6 run tests/load/k6-load-test.js
```

#### **macOS/Linux:**
```bash
# Set environment variables
export SUPABASE_URL="https://yieslxnrfeqchbcmgavz.supabase.co"
export SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export EVENT_ID="a1b2c3d4-..."
export TIER_ID="e5f6g7h8-..."

# Run k6
k6 run tests/load/k6-load-test.js
```

### **Step 4: Interpret k6 Results**

**Expected Output:**
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
              * default: Up to 100 looping VUs for 1m10s

     ✓ reserve: status 200 or 409
     ✓ reserve: has session_url or error

     checks.........................: 100.00% ✓ 2468      ✗ 0
     data_received..................: 1.2 MB  17 kB/s
     data_sent......................: 890 kB  13 kB/s
     http_req_blocked...............: avg=1.23ms   min=0s      med=0s      max=234.56ms p(90)=0s       p(95)=0s      
     http_req_connecting............: avg=456.78µs min=0s      med=0s      max=123.45ms p(90)=0s       p(95)=0s      
     http_req_duration..............: avg=342.12ms min=123.45ms med=298.76ms max=1.23s   p(90)=456.78ms p(95)=567.89ms
       { expected_response:true }...: avg=342.12ms min=123.45ms med=298.76ms max=1.23s   p(90)=456.78ms p(95)=567.89ms
     http_req_failed................: 2.34%   ✓ 58        ✗ 2410
     http_req_receiving.............: avg=123.45µs min=0s      med=0s      max=12.34ms  p(90)=0s       p(95)=0s      
     http_req_sending...............: avg=234.56µs min=0s      med=0s      max=23.45ms  p(90)=0s       p(95)=0s      
     http_req_tls_handshaking.......: avg=0s       min=0s      med=0s      max=0s       p(90)=0s       p(95)=0s      
     http_req_waiting...............: avg=341.76ms min=123.21ms med=298.34ms max=1.22s   p(90)=456.12ms p(95)=567.23ms
     http_reqs......................: 2468    35.257/s
     iteration_duration.............: avg=1.42s    min=1.12s   med=1.34s   max=2.45s    p(90)=1.78s    p(95)=1.89s   
     iterations.....................: 1234    17.628/s
     reserve_failures...............: 2.34%   ✓ 58        ✗ 2410
     reserve_latency................: avg=345.23ms min=125.67ms med=301.23ms max=1.25s   p(90)=458.90ms p(95)=570.12ms
     vus............................: 100     max: 100    min: 0
     vus_max........................: 100     max: 100    min: 100

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
  ✅ http_req_duration: p(90)<500: PASS
  ✅ reserve_failures: rate<0.05: PASS
```

**What to look for:**

✅ **Good:**
- `http_req_duration p(90)` < 500ms
- `http_req_duration p(99)` < 1000ms
- `reserve_failures` < 5% (excluding legitimate sold-out)
- `checks` = 100% or close

❌ **Problems:**
- `http_req_failed` > 10%
- `p(99)` > 2000ms
- Many 500 errors

---

## 📋 Quick Decision Tree

```
Do you have PostgreSQL installed?
├─ YES → Use pgbench (best for database testing)
│         Takes 15 minutes to setup
│         Tests true database concurrency
│
└─ NO → Use k6 (easier, no PostgreSQL needed)
          Takes 5 minutes to setup
          Tests full API stack
          More realistic user simulation
```

---

## 🚀 Quickest Path: k6

If you want to **test right now** without installing PostgreSQL:

### **1. Install k6 (2 minutes)**

**Windows:**
```powershell
# Run PowerShell as Administrator
choco install k6

# Or download from: https://dl.k6.io/msi/k6-latest-amd64.msi
```

### **2. Get Your Values (1 minute)**

Run in Supabase SQL Editor:
```sql
-- Get event and tier IDs
SELECT 
  e.id as event_id,
  tt.id as tier_id,
  e.title,
  tt.name
FROM events e
JOIN ticket_tiers tt ON tt.event_id = e.id
WHERE e.title LIKE '[RACE TEST]%'
ORDER BY e.created_at DESC
LIMIT 1;
```

Get from your `.env` or Supabase Dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### **3. Run Test (2 minutes)**

```powershell
# Set environment variables (replace with your actual values)
$env:SUPABASE_URL="https://yieslxnrfeqchbcmgavz.supabase.co"
$env:SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
$env:EVENT_ID="your-event-id-here"
$env:TIER_ID="your-tier-id-here"

# Run k6
k6 run tests/load/k6-load-test.js
```

### **4. Check Results**

Look for:
- ✅ `http_req_duration p(90)` < 500ms
- ✅ `reserve_failures` < 5%
- ✅ No overselling in database (run verification query)

---

## 🎯 Complete Testing Workflow

### **Minimum for TestFlight:**
1. ✅ Simple concurrent test (DONE - you passed!)
2. ⚠️ k6 API load test (5 min setup)

### **Gold Standard for Production:**
1. ✅ Simple concurrent test (DONE)
2. ✅ k6 API load test
3. ✅ pgbench database concurrency test
4. ✅ All 5 invariant checks pass

---

## 💡 My Recommendation for You

**Right now (before TestFlight):**

Run **k6** because:
- ✅ Faster to set up (no PostgreSQL needed)
- ✅ Tests full stack (closer to real users)
- ✅ Easy to interpret results
- ✅ Cross-platform (works on Windows easily)

**Commands:**
```powershell
# 1. Install k6
choco install k6

# 2. Set environment variables (update these!)
$env:SUPABASE_URL="https://yieslxnrfeqchbcmgavz.supabase.co"
$env:SUPABASE_ANON_KEY="your-anon-key"
$env:EVENT_ID="your-event-id"
$env:TIER_ID="your-tier-id"

# 3. Run test
k6 run tests/load/k6-load-test.js
```

**Later (before App Store production):**

Install PostgreSQL and run **pgbench** for the ultimate database race-condition validation.

---

## 📊 Comparison

| Feature | Your SQL Test | pgbench | k6 |
|---------|---------------|---------|-----|
| True Concurrency | ❌ No | ✅ YES (50+ sessions) | ✅ YES (100+ VUs) |
| Setup Time | 0 min ✅ | 15 min | 5 min ✅ |
| Tests Database | ✅ YES | ✅ YES | ❌ No |
| Tests API | ❌ No | ❌ No | ✅ YES |
| Latency Percentiles | ❌ No | ✅ YES | ✅ YES |
| Easy on Windows | ✅ YES | ⚠️ Requires PostgreSQL | ✅ YES |
| Production Ready | ⚠️ Simulation | ✅ YES | ✅ YES |

---

## ✅ Bottom Line

**You've already passed the functional test!** 🎉

**For extra confidence before TestFlight:**
- Run **k6** (quick and easy)

**For production-grade validation:**
- Run **both k6 AND pgbench**

---

**Want to run k6 now? I can help you set it up!** Just let me know and I'll walk you through it step-by-step. 🚀



