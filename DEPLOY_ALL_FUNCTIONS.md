# ✅ Deploy All Edge Functions

## ✅ **Already Deployed:**
- ✅ `stripe-webhook` (via npx - SUCCESS!)

---

## 🚀 **Deploy Remaining Functions**

Run these commands one at a time:

### 1. Deploy `process-email-queue`
```powershell
npx supabase@latest functions deploy process-email-queue
```

### 2. Deploy `process-webhook-retries`
```powershell
npx supabase@latest functions deploy process-webhook-retries
```

### 3. Deploy `send-email` (update existing)
```powershell
npx supabase@latest functions deploy send-email
```

---

## ✅ **What Gets Deployed:**

The CLI automatically bundles:
- ✅ Main function file (`index.ts`)
- ✅ All `_shared/` utilities (logger, queue-utils, retry-utils, rate-limiter)

**No standalone files needed!** The original `index.ts` files work perfectly with CLI.

---

## 🎯 **After Deployment:**

All functions will be ready for Phase 2.1 hardening features:
- ✅ Email queue system
- ✅ Webhook retry queue
- ✅ DLQ support for failed webhooks

---

## 📝 **Note:**

You can also deploy all at once:
```powershell
npx supabase@latest functions deploy process-email-queue process-webhook-retries send-email
```

But it's safer to deploy one at a time to catch any errors early.

