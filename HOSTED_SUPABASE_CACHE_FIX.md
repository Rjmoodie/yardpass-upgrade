# 🌐 Fix PostgREST Cache on Hosted Supabase

**Issue:** PostgREST schema cache is stale (doesn't see `cart_snapshot` column)  
**Environment:** Hosted Supabase (not local Docker)  
**Status:** ✅ Solutions available

---

## 🚀 **SOLUTION 1: Force Schema Reload (Fastest)**

Run this SQL command to force PostgREST to refresh:

```bash
supabase db execute --file /tmp/force_schema_reload.sql
```

**Or run directly:**
```sql
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
```

**What it does:**
- Sends signal to PostgREST to reload immediately
- No restart needed
- Works on hosted Supabase

**Time:** Instant

---

## 🕐 **SOLUTION 2: Wait for Auto-Refresh**

PostgREST automatically refreshes schema every **10 minutes**.

**Action:** Wait 5-10 minutes, then test checkout

**No commands needed** - just wait and test.

---

## 🧪 **SOLUTION 3: Test Now (Might Already Work!)**

The migration sent `NOTIFY pgrst, 'reload schema'` - it might already be fixed!

**Try this:**
1. **Refresh browser** (`Cmd + Shift + R`)
2. Clear console (`Cmd + K`)
3. Go to an event
4. Try buying a ticket

**If it works:**
- ✅ Cache already refreshed
- ✅ No action needed!

**If still 500 error:**
- Use Solution 1 or 2

---

## 🎯 **Recommended Approach**

**Step 1: Test now** (might already work)  
**Step 2: If fails, run NOTIFY command**  
**Step 3: Wait 2 minutes, test again**

---

## 📊 **How to Know It's Fixed**

### **Before Fix:**
```javascript
❌ POST .../enhanced-checkout 500 (Internal Server Error)
❌ startCheckout error: Edge Function returned a non-2xx status code

Logs show:
PGRST204: Could not find 'cart_snapshot' column
```

### **After Fix:**
```javascript
✅ Calling enhanced-checkout (authenticated)...
✅ Checkout response: { data: { client_secret: "present" } }
✅ Setting session data
✅ Checkout session ready
✅ Tickets held

No PGRST204 error!
```

---

## 🔧 **Why This Happens on Hosted Supabase**

**Local Supabase:**
- You control Docker
- Can restart anytime
- Cache refreshes on restart

**Hosted Supabase:**
- PostgREST runs in Supabase's infrastructure
- Can't manually restart
- Must use `NOTIFY` command or wait for auto-refresh

---

## ✅ **What I've Already Done**

1. ✅ Verified `cart_snapshot` column exists
2. ✅ Created migration with `NOTIFY pgrst, 'reload schema'`
3. ✅ Applied migration (`supabase db push` succeeded)
4. ✅ Restored `cart_snapshot` in checkout code
5. ✅ Edge Functions deployed with fix

**Remaining:** PostgREST cache refresh (automatic or forced)

---

## 🎯 **NEXT STEPS**

### **Try This NOW:**

**1. Force cache reload:**
```bash
cd /Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade

cat << 'EOF' | supabase db execute
NOTIFY pgrst, 'reload schema';
SELECT 'PostgREST notified to reload' as status;
EOF
```

**2. Wait 30 seconds** (for cache to refresh)

**3. Test checkout:**
- Refresh browser
- Buy a ticket
- Should work!

---

## 🆘 **If Still Failing After 10 Minutes**

**Last resort - bypass cart_snapshot:**

```bash
# Comment out cart_snapshot in the code
# Then redeploy
supabase functions deploy enhanced-checkout --no-verify-jwt
supabase functions deploy guest-checkout --no-verify-jwt
```

**This sacrifices audit trail but makes checkout work immediately.**

---

## 📞 **Alternative: Contact Supabase**

If cache won't refresh, you can:
1. Open Supabase Dashboard
2. Go to Database → Extensions
3. Look for "PostgREST" settings
4. Or contact support to manually refresh

**But NOTIFY command should work!**

---

**Try the NOTIFY command now and wait 30 seconds!** ⚡


