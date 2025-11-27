# 🚀 Deploy Edge Functions via Dashboard (Standalone Versions)

The Dashboard doesn't bundle `_shared/` imports, so I've created **standalone versions** with all shared utilities inlined.

## 📁 Files to Deploy

### Option 1: Use Standalone Files (Recommended)

I've created standalone versions in each function directory:
- `supabase/functions/process-email-queue/standalone.ts`
- `supabase/functions/process-webhook-retries/standalone.ts` (coming next)
- `supabase/functions/send-email/standalone.ts` (coming next)
- `supabase/functions/stripe-webhook/standalone.ts` (coming next)

**Copy the contents of these standalone files into the Dashboard editor.**

### Option 2: Replace index.ts with Standalone Code

Alternatively, you can replace the `index.ts` files with the standalone code, but this will break CLI deployments.

---

## 📋 Deployment Steps

### 1. Deploy `process-email-queue`

1. Go to **Supabase Dashboard → Edge Functions**
2. Click **"Create a new function"** or find existing `process-email-queue`
3. **Copy entire contents** from: `supabase/functions/process-email-queue/standalone.ts`
4. Paste into the code editor
5. Click **"Deploy"**

### 2. Deploy `process-webhook-retries`

1. Click **"Create a new function"** or find existing `process-webhook-retries`
2. **Copy entire contents** from: `supabase/functions/process-webhook-retries/standalone.ts`
3. Paste and deploy

### 3. Update `send-email`

1. Find existing `send-email` function
2. Click **"Edit"**
3. **Copy entire contents** from: `supabase/functions/send-email/standalone.ts`
4. Replace existing code
5. Deploy

### 4. Update `stripe-webhook`

1. Find existing `stripe-webhook` function
2. Click **"Edit"**
3. **Copy entire contents** from: `supabase/functions/stripe-webhook/standalone.ts`
4. Replace existing code
5. Deploy

---

## ✅ Verification

After deployment, verify:
- All functions show as **"Active"** in Dashboard
- No import errors in function logs
- Functions can be invoked successfully

---

## 🔄 Future: Use CLI (Recommended)

Once you install the Supabase CLI, you can use the original `index.ts` files (which import from `_shared/`). The CLI automatically bundles shared code.

```powershell
npm install -g supabase
supabase functions deploy process-email-queue
supabase functions deploy process-webhook-retries
supabase functions deploy send-email
supabase functions deploy stripe-webhook
```

