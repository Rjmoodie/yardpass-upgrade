-- Create a Test Flashback Event
-- STEP 1: Find your user ID first (run find-my-user-id.sql)
-- STEP 2: Replace <YOUR_USER_ID> below with your actual UUID
-- STEP 3: Run this query

INSERT INTO events.events (
  title,
  description,
  start_at,
  end_at,
  created_by,
  owner_context_type,
  owner_context_id,
  is_flashback,
  flashback_explainer,
  visibility,
  venue,
  address,
  city,
  country,
  category,
  cover_image_url
) VALUES (
  'Summer Music Festival 2024 (Flashback)',
  'Relive the amazing moments from last year''s music festival! Share your photos, videos, and memories with the community.',
  '2024-07-15 18:00:00+00',  -- Past event (July 2024)
  '2024-07-17 23:00:00+00',  -- Ended July 17, 2024
  '<YOUR_USER_ID>',          -- ← Replace this!
  'individual',
  '<YOUR_USER_ID>',          -- ← Replace this!
  true,                      -- is_flashback = true
  'Share your favorite moments from Summer Fest 2024! 📸 Upload your photos and videos to help us build excitement for this year''s event.',
  'public',
  'Central Park Main Stage',
  '1234 Park Ave',
  'New York City',
  'United States',
  'Music',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200'  -- Sample festival image
) RETURNING id, title, is_flashback, flashback_end_date;

-- After running, you'll see:
-- ✅ id: <new_event_id>
-- ✅ title: "Summer Music Festival 2024 (Flashback)"
-- ✅ is_flashback: true
-- ✅ flashback_end_date: 2024-10-15 (event_end + 90 days)

-- Then visit: https://yardpass.tech/e/<event_id>
-- You should see the flashback banner! 🎬

