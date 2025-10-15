-- Step 1: Run this query to find your user ID
-- Copy the 'id' value from the results

select 
  id as user_id,
  email,
  created_at
from auth.users
order by created_at desc
limit 10;

-- The 'user_id' column will show something like:
-- 34cce931-f181-4caf-8f05-4bcc7ee3ecaa
--
-- Copy that UUID and use it in the test-notifications.sql file



