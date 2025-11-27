# 🚀 Deploy Edge Functions via Supabase Dashboard

Since the Supabase CLI isn't available, you can deploy Edge Functions directly through the Supabase Dashboard.

---

## 📋 Method 1: Supabase Dashboard (Recommended)

### Step 1: Go to Edge Functions
1. Open your **Supabase Dashboard**
2. Navigate to: **Edge Functions** (left sidebar)
3. You'll see a list of existing functions

### Step 2: Deploy New Functions

#### Deploy `process-email-queue`
1. Click **"Create a new function"** or **"New Function"**
2. **Function name:** `process-email-queue`
3. **Copy the entire contents** of: `supabase/functions/process-email-queue/index.ts`
4. Paste into the code editor
5. Click **"Deploy"** or **"Save"**

#### Deploy `process-webhook-retries`
1. Click **"Create a new function"** or **"New Function"**
2. **Function name:** `process-webhook-retries`
3. **Copy the entire contents** of: `supabase/functions/process-webhook-retries/index.ts`
4. Paste into the code editor
5. Click **"Deploy"** or **"Save"**

### Step 3: Update Existing Functions

#### Update `send-email`
1. Find `send-email` in the functions list
2. Click **"Edit"** or the function name
3. **Replace the entire contents** with: `supabase/functions/send-email/index.ts`
4. Click **"Deploy"** or **"Save"**

#### Update `stripe-webhook`
1. Find `stripe-webhook` in the functions list
2. Click **"Edit"** or the function name
3. **Replace the entire contents** with: `supabase/functions/stripe-webhook/index.ts`
4. Click **"Deploy"** or **"Save"**

---

## 📋 Method 2: Install Supabase CLI (Optional)

If you want to use the CLI in the future:

### Windows (PowerShell)
```powershell
# Install via Scoop (if you have it)
scoop install supabase

# Or via npm
npm install -g supabase

# Or download from: https://github.com/supabase/cli/releases
```

### Verify Installation
```powershell
supabase --version
```

---

## ✅ After Deployment

### Verify Functions Are Active
1. Go to **Edge Functions** in Dashboard
2. Check that all 4 functions show as **"Active"**:
   - ✅ `process-email-queue`
   - ✅ `process-webhook-retries`
   - ✅ `send-email`
   - ✅ `stripe-webhook`

### Set Up Cron Jobs
After functions are deployed, set up the cron jobs (see `DEPLOYMENT_CHECKLIST.md`)

---

## 🆘 Troubleshooting

**If you can't find "Create Function" button:**
- Make sure you have the correct permissions
- Try refreshing the page
- Check if functions are enabled in your project settings

**If deployment fails:**
- Check the error message in the Dashboard
- Verify all imports are correct
- Make sure shared utilities are accessible (they should be auto-included)

---

**Quick Tip:** You can also use the Supabase Dashboard's **"Import from file"** feature if available, which lets you upload the entire function directory.

