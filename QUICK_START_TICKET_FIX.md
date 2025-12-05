# 🚀 Quick Start - Fix Liventix Event Tickets

**Problem:** 90 tickets stuck as "reserved" → Event shows SOLD OUT incorrectly  
**Solution:** Run 2 simple SQL files  
**Time:** 5 minutes

---

## 📋 Steps (Copy-Paste Friendly)

### **1. Setup Functions (One-Time)**

**File:** `fix-ticket-accounting-simple.sql`

1. Open **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. **Copy entire contents** of `fix-ticket-accounting-simple.sql`
4. **Paste** into editor
5. Click **RUN**

**Expected:** ✅ "Functions created successfully!"

---

### **2. Fix Liventix Event**

**File:** `run-liventix-event-fix.sql`

#### **2a. Dry-Run (Preview Changes)**

1. **Copy** the STEP 1 section from `run-liventix-event-fix.sql`
2. **Paste** into SQL Editor
3. Click **RUN**

**Review output:**
```json
{
  "step": 2,
  "action": "Expired holds cleanup",
  "status": "DRY_RUN",
  "details": {"holds_affected": 90, "tiers_updated": 1}
}
```

**If this looks correct** (should free ~90 holds), proceed to 2b.

---

#### **2b. Execute Fix**

1. In `run-liventix-event-fix.sql`, **comment out** STEP 1 (add `--` at start of lines)
2. **Uncomment** STEP 2 (remove `--` from those lines)
3. **Copy and paste** into SQL Editor
4. Click **RUN**

**Expected:**
```json
{
  "step": 5,
  "status": "SUMMARY",
  "details": {
    "tier_name": "General Admission",
    "available": 87-90,  // ✅ Tickets now available!
    "reserved": 0
  }
}
```

---

#### **2c. Verify**

1. **Copy** STEP 3 from `run-liventix-event-fix.sql`
2. **Paste** and **RUN**

**Expected result:**
```
tier_name          | total | reserved | issued | available | status
General Admission  | 100   | 0        | 10     | 90        | ✅ TICKETS AVAILABLE
```

---

### **3. Test in App**

1. Open your app
2. Go to "Liventix Official Event!"
3. Click "Get Tickets"
4. Should now show **"90 available"** instead of "SOLD OUT"
5. Try purchasing - should work!

---

## 🔍 Troubleshooting

### **"Function already exists" error:**
✅ **This is fine!** It means functions were created previously. Script will update them.

### **"Permission denied" error:**
❌ **You need service_role key** or admin access to create functions.

### **Dry-run shows 0 holds affected:**
✅ **This is good!** Means the issue was already fixed or doesn't apply to this event.

### **Still shows SOLD OUT after fix:**
1. Check STEP 3 verification query
2. If reserved = 0 but available = 0, then tickets are actually sold
3. If reserved > 0, run the fix again

---

## 📞 Need Help?

**Check health status:**
```sql
SELECT * FROM ticketing.event_health 
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1';
```

**If health_score > 0:** Issues remain, review TICKET_ACCOUNTING_RUNBOOK.md

---

**Estimated Time:** 5 minutes  
**Risk Level:** LOW (dry-run mode prevents accidents)  
**Rollback:** Automatic (soft-deletes preserve data)

