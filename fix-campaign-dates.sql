-- Update your campaign dates to start today and make it active
UPDATE campaigns.campaigns
SET 
  start_date = NOW()::date,  -- Set to today
  end_date = (NOW() + INTERVAL '7 days')::date,  -- End in 7 days
  status = 'active'
WHERE name LIKE '%test- your ad here part 2%'
  AND org_id IN (
    SELECT org_id FROM organizations.org_memberships 
    WHERE user_id = auth.uid()
  )
RETURNING id, name, start_date, end_date, status;

