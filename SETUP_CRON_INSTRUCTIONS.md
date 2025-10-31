# Set Up Analytics Auto-Refresh (Cron Job)

## Option A: Supabase Dashboard Cron (Recommended)

### Steps:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **yieslxnrfeqchbcmgavz**
3. Navigate to **Database** > **Cron Jobs** (in the sidebar)
4. Click **Create a new cron job**
5. Configure:
   - **Name**: `refresh-analytics-matview`
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **SQL Command**:
     ```sql
     SELECT public.refresh_analytics();
     ```
6. Click **Create**

### Verify It's Working:
```sql
-- Check last refresh time
SELECT 
  schemaname, 
  matviewname, 
  last_refresh 
FROM pg_stat_user_tables 
WHERE schemaname = 'public' 
  AND relname = 'analytics_campaign_daily_mv';
```

---

## Option B: Manual Refresh (Temporary)

If you can't set up cron right now, you can manually refresh:

```sql
SELECT public.refresh_analytics();
```

Run this whenever you want fresh analytics data.

---

## Why Every 5 Minutes?

- **Acceptable staleness** for analytics (not real-time critical)
- **Low database load** (concurrent refresh doesn't block reads)
- **Good balance** between freshness and performance

You can adjust to:
- `*/15 * * * *` - Every 15 minutes (lighter load)
- `*/1 * * * *` - Every 1 minute (more real-time, higher load)

---

## ✅ Success Criteria

After setup, you should see:
- Matview updates every 5 minutes
- Dashboard shows fresh data without manual refresh
- No performance impact on queries



