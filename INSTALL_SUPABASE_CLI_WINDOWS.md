# 🔧 Install Supabase CLI on Windows

## ❌ Why npm install failed

Supabase CLI no longer supports `npm install -g supabase`. You need to use a different method.

---

## ✅ **Option 1: Use Scoop** (Recommended for Windows)

If you have Scoop installed:

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

If you don't have Scoop, install it first:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex
```

---

## ✅ **Option 2: Download Binary Directly**

1. Go to: https://github.com/supabase/cli/releases/latest
2. Download: `supabase_X.X.X_windows_amd64.zip`
3. Extract the `supabase.exe` file
4. Add to PATH or use full path:
   ```powershell
   C:\path\to\supabase.exe functions deploy stripe-webhook
   ```

---

## ✅ **Option 3: Use npx (No Installation)**

Run without installing:

```powershell
npx supabase@latest functions deploy stripe-webhook
```

This downloads and runs the CLI temporarily.

---

## 🎯 **Recommendation: Use Minimal Patch Instead**

Since CLI installation is complex, I recommend using the **minimal patch approach** instead:

1. ✅ Faster (5 minutes)
2. ✅ No installation needed
3. ✅ Works with Dashboard
4. ✅ Minimal changes to existing code

See: `supabase/functions/stripe-webhook/DLQ_PATCH.md`

---

## 🚀 **Quick Decision**

- **Want CLI?** → Use Option 3 (`npx`) - easiest, no install needed
- **Want fastest fix?** → Use minimal patch in Dashboard

