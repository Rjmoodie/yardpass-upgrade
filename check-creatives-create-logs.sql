-- This is just a reminder to check the creatives-create edge function logs
-- in your Supabase Dashboard

-- Go to: Edge Functions → creatives-create → Logs
-- Look for the most recent 400 error and see what the error message says

-- Common issues to look for:
-- 1. "campaign_id is required" - missing or null campaign_id
-- 2. "Unauthorized" - user doesn't have access to the organization
-- 3. "media_url is required" - missing media_url in the request
-- 4. Database constraint violation - check the error details

