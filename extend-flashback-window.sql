-- Extend flashback posting window for testing
-- Event ID: 427745da-3195-4426-8c31-ad574d82861a

UPDATE events.events 
SET flashback_end_date = now() + interval '30 days'
WHERE id = '427745da-3195-4426-8c31-ad574d82861a'
RETURNING 
  id,
  title,
  flashback_end_date,
  flashback_end_date - now() AS time_remaining;

-- ✅ This extends the posting window for 30 more days
-- 
-- After running, refresh the event page:
-- https://yardpass.tech/e/427745da-3195-4426-8c31-ad574d82861a
--
-- You should now see:
-- ✅ "Posting closes in 30 days"
-- ✅ Ability to create posts
-- ✅ Media requirement enforced
-- ✅ 300 character limit enforced
-- ✅ Links automatically stripped

