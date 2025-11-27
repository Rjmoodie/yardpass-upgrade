# 🚀 Deploy scanner-validate Edge Function

## ✅ What to Deploy

The `scanner-validate` function has been updated with:
- ✅ Atomic redemption (SELECT FOR UPDATE)
- ✅ Timestamp replay detection
- ✅ Rate limiting (per scanner + per event)
- ✅ Anomaly detection logging

---

## 📋 Deployment Command

```bash
npx supabase@latest functions deploy scanner-validate --no-verify-jwt
```

**Note:** The `--no-verify-jwt` flag allows the function to be called without JWT verification (already configured for scanner use case).

---

## 🔧 Optional: Configure Rate Limits

If you want to customize rate limits (defaults: 10/min per scanner, 200/min per event):

1. Go to Supabase Dashboard > Project Settings > Edge Functions > Secrets
2. Add environment variables:
   - `SCANNER_RATE_LIMIT_PER_MINUTE` = `10` (or your preferred limit)
   - `SCANNER_RATE_LIMIT_EVENT_PER_MINUTE` = `200` (or your preferred limit)
3. Restart the Edge Function after adding secrets

---

## ✅ Verification

After deployment, test by:
1. Scanning a QR code
2. Checking that rate limiting works (try 15 scans in 1 minute)
3. Verifying logs show anomaly flags when appropriate

---

**Ready to deploy!** Run the command above.

