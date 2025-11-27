# 🔑 Get Service Role Key for Cron Jobs

## ⚠️ **Important**

The key you provided appears to be an **ANON key** (decoded JWT shows `"role":"anon"`).

For cron jobs, you should ideally use the **SERVICE_ROLE_KEY** which has admin access and bypasses RLS.

---

## ✅ **Get Service Role Key**

1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/settings/api

2. Scroll down to **"Project API keys"**

3. Find **"service_role"** key (NOT "anon public")

4. Click **"Reveal"** to show the key

5. Copy the entire key (starts with `eyJ...`)

---

## 🔒 **Security Note**

- ✅ **ANON key** = Public, limited permissions, respects RLS
- ✅ **SERVICE_ROLE key** = Admin, full database access, bypasses RLS

**For cron jobs:** Use SERVICE_ROLE key because:
- Edge Functions need to access all tables (including queues)
- They need to bypass RLS to process items
- They're internal system operations (not user-facing)

---

## ✅ **Option 1: Use Service Role Key (Recommended)**

1. Get Service Role Key from Dashboard
2. Open `SETUP_CRON_JOBS_READY.sql`
3. Replace the token in both cron job commands with Service Role Key
4. Run the SQL in Supabase SQL Editor

---

## ✅ **Option 2: Test with Anon Key First**

If you want to test quickly with the anon key you provided:

1. Use `SETUP_CRON_JOBS_READY.sql` as-is
2. If cron jobs fail with permission errors, switch to Service Role Key
3. If they work, you can keep using anon key (less secure for internal ops)

---

## 🎯 **Recommendation**

Use **Service Role Key** for production cron jobs. It's safer and more reliable for system operations.

