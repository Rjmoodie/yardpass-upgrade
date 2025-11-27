# 🚀 Dashboard Deployment Instructions

## Problem
The Dashboard doesn't bundle `_shared/` imports, causing "Module not found" errors.

## Solution
I've created **standalone versions** with all shared utilities inlined. These are ready to copy-paste into the Dashboard.

---

## 📁 Standalone Files Created

1. ✅ `supabase/functions/process-email-queue/standalone.ts`
2. ✅ `supabase/functions/process-webhook-retries/standalone.ts`
3. ✅ `supabase/functions/send-email/standalone.ts`
4. ⏳ `supabase/functions/stripe-webhook/standalone.ts` (creating now...)

---

## 📋 Deployment Steps

### For Each Function:

1. **Open Supabase Dashboard → Edge Functions**
2. **Find or create the function** (e.g., `process-email-queue`)
3. **Open the standalone file** in your editor (e.g., `supabase/functions/process-email-queue/standalone.ts`)
4. **Copy the ENTIRE contents** (Ctrl+A, Ctrl+C)
5. **Paste into Dashboard editor** (Ctrl+V)
6. **Click "Deploy" or "Save"**

---

## ✅ Functions to Deploy

- [ ] `process-email-queue` → Use `standalone.ts`
- [ ] `process-webhook-retries` → Use `standalone.ts`
- [ ] `send-email` → Use `standalone.ts` (update existing)
- [ ] `stripe-webhook` → Use `standalone.ts` (update existing)

---

## 🔍 Verification

After deployment:
1. Check function status is **"Active"**
2. Check function logs for any errors
3. Test invoking the function

---

## 📝 Note

The standalone files are **self-contained** - they include all shared utilities (logger, retry, queue, rate limiter) inline. This makes them larger but ensures they work in the Dashboard.

Once you install the Supabase CLI, you can use the original `index.ts` files which import from `_shared/`.

