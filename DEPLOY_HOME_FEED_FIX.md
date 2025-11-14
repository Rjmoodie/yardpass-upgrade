# 🚀 Deploy home-feed Edge Function Fix

## ✅ CORS Fix Applied

Updated `supabase/functions/home-feed/index.ts` to include production domains:

```typescript
const ALLOWED_ORIGINS = [
  "https://www.liventix.tech",     // ← ADDED
  "https://liventix.tech",         // ← ADDED
  "https://app.liventix.com",
  "https://staging.liventix.com",
  "http://localhost:8080",         // ← ADDED
  "http://localhost:5173",
  "http://localhost:4173",         // ← ADDED
]
```

## 📤 Deploy Command

Run this to deploy the fixed edge function:

```bash
npx supabase functions deploy home-feed
```

## ⏱️ After Deployment

Wait 1-2 minutes, then:
1. Visit https://www.liventix.tech
2. Hard refresh (Ctrl+Shift+R)
3. Feed should load! ✅

## 🎯 This Fixes

- ✅ CORS error: "No 'Access-Control-Allow-Origin' header"
- ✅ Allows requests from www.liventix.tech
- ✅ Allows requests from liventix.tech
- ✅ Keeps localhost working for development


