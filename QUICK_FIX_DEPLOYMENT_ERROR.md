# 🚨 Quick Fix: Deployment Error

## The Problem
Dashboard returned "Function deploy failed due to an internal error" - likely due to file size (611 lines).

## ✅ Solution Options

### **Option 1: Apply Minimal Patch** (Easiest - 5 minutes)
Instead of replacing the entire file, just add the DLQ logic to your existing code.

📄 See: `supabase/functions/stripe-webhook/DLQ_PATCH.md`

**Steps:**
1. Open your existing `stripe-webhook` function in Dashboard
2. Follow the patch instructions (add ~50 lines)
3. Deploy

---

### **Option 2: Install CLI and Deploy Properly** (Best - 10 minutes)

```powershell
# Install Supabase CLI
npm install -g supabase

# Deploy the original index.ts (which imports from _shared/)
supabase functions deploy stripe-webhook
```

The CLI automatically bundles `_shared/` utilities, so the original `index.ts` will work.

---

### **Option 3: Try Smaller Function** (Test)

Try deploying one of the smaller standalone functions first to verify Dashboard works:
- `process-email-queue/standalone.ts` (287 lines)
- `send-email/standalone.ts` (132 lines)

If those work, the issue is specifically with the large `stripe-webhook` file.

---

## 🎯 Recommendation

**Use Option 1** (minimal patch) - it's the safest and fastest. You keep all your existing code and just add the DLQ feature.

Want me to walk you through the patch step-by-step?

