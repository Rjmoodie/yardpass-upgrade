# Deploy refresh-analytics Edge Function (Optional)

## Why This Is Optional

The Edge Function is only needed if you want:
- ✅ Better monitoring/logging
- ✅ Error handling/alerts
- ✅ Custom pre/post-refresh logic

**You don't need it if:**
- ❌ Supabase Dashboard cron works fine
- ❌ You just want simple auto-refresh

---

## Deployment Options

### Option A: Supabase Dashboard (Easiest)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Edge Functions**
3. Click **Create a new function**
4. Name: `refresh-analytics`
5. Paste the code from: `supabase/functions/refresh-analytics/index.ts`
6. Deploy
7. Set up cron trigger:
   - Schedule: `*/5 * * * *`
   - Method: POST
   - Add header: `Authorization: Bearer <CRON_SECRET>` (optional)

### Option B: Supabase CLI

If you have Supabase CLI installed:

```bash
# Deploy the function
supabase functions deploy refresh-analytics

# Set up environment variables (if needed)
supabase secrets set CRON_SECRET=your-secret-here
```

---

## Skip This Step If:

✅ Database cron (Option A from Step 2) is working  
✅ You don't need custom logging  
✅ Simple refresh is sufficient  

**Recommendation: Skip for now, add later if needed**

---

## ✅ Success Criteria

If you deploy:
- Edge Function shows in dashboard
- Cron trigger calls function every 5 minutes
- Logs show successful refreshes
- Matview stays fresh



