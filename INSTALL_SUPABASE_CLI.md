# 📦 Install Supabase CLI on Windows

## Quick Install (via npm - if you have Node.js)

```powershell
npm install -g supabase
```

## Alternative: Download Binary

1. Go to: https://github.com/supabase/cli/releases/latest
2. Download: `supabase_X.X.X_windows_amd64.zip`
3. Extract the `supabase.exe` file
4. Add to PATH or use full path when running

## Verify Installation

```powershell
supabase --version
```

## After Installation

Then you can deploy:
```powershell
supabase functions deploy process-email-queue
supabase functions deploy process-webhook-retries
supabase functions deploy send-email
supabase functions deploy stripe-webhook
```

---

**For now, use the Dashboard method (faster if CLI isn't installed).**

