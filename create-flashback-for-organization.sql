-- Create Test Flashback Event for ORGANIZATION
-- 
-- STEP 1: Run find-my-organizations.sql to get your org_id
-- STEP 2: Replace <YOUR_ORG_ID> below with the org_id
-- STEP 3: Run this query
--
-- User: datmahseh@gmail.com
-- User ID: 86289a38-799e-4e76-b3dd-2f9615e56afa

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
  cover_image_url,
  lat,
  lng
) VALUES (
  'Summer Music Festival 2024 (Flashback)',
  'Relive the amazing moments from last year''s epic music festival! Share your photos, videos, and memories with the community. Let''s celebrate the incredible artists, fans, and vibes that made Summer Fest 2024 unforgettable!',
  '2024-07-15 18:00:00+00',  -- July 15, 2024 (past event)
  '2024-07-17 23:00:00+00',  -- July 17, 2024 (ended)
  '86289a38-799e-4e76-b3dd-2f9615e56afa',  -- datmahseh@gmail.com (creator)
  'organization',                           -- ✅ ORGANIZATION, not individual
  '<YOUR_ORG_ID>',                         -- ← REPLACE WITH YOUR ORG ID FROM STEP 1
  true,                                     -- is_flashback = true
  'Share your favorite moments from Summer Fest 2024! 📸 Upload your photos and videos to help us build excitement for this year''s event.',
  'public',
  'Central Park Main Stage',
  '1234 Park Avenue South',
  'New York City',
  'United States',
  'Music',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200',
  40.7829,  -- Central Park
  -73.9654
) RETURNING 
  id, 
  title, 
  is_flashback, 
  flashback_end_date,
  owner_context_type,
  owner_context_id;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- RESULT:
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- id: <new_event_uuid>
-- title: "Summer Music Festival 2024 (Flashback)"
-- is_flashback: true
-- flashback_end_date: 2024-10-15 23:00:00+00 (auto-calculated!)
-- owner_context_type: "organization"
-- owner_context_id: <your_org_id>

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TEST IT:
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Visit: https://yardpass.tech/e/<returned_id>
-- 
-- You should see:
-- ✅ Flashback banner with purple gradient
-- ✅ Custom explainer message
-- ✅ Countdown: "Posting closes in X days"
-- ✅ (Optional) Link to new event if configured

