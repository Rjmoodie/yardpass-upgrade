-- Create Test Flashback Event for YardPass Official
-- Organization ID: 9398c599-4cde-4ac5-8d8c-a62d0c057c00
-- Creator: datmahseh@gmail.com (86289a38-799e-4e76-b3dd-2f9615e56afa)
-- READY TO RUN - No edits needed!

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
  'organization',                           -- ✅ Organization-owned
  '9398c599-4cde-4ac5-8d8c-a62d0c057c00',  -- ✅ YardPass Official
  true,                                     -- is_flashback = true
  'Share your favorite moments from Summer Fest 2024! 📸 Upload your photos and videos to help us build excitement for this year''s event.',
  'public',
  'Central Park Main Stage',
  '1234 Park Avenue South',
  'New York City',
  'United States',
  'Music',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200',  -- Festival crowd
  40.7829,  -- Central Park coordinates
  -73.9654
) RETURNING 
  id, 
  title, 
  is_flashback, 
  flashback_end_date,
  owner_context_type,
  owner_context_id;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ✅ EXPECTED RESULT:
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- id: <new_event_uuid>
-- title: "Summer Music Festival 2024 (Flashback)"
-- is_flashback: true
-- flashback_end_date: 2024-10-15 23:00:00+00 (✅ auto-calculated: event_end + 90 days)
-- owner_context_type: "organization"
-- owner_context_id: "9398c599-4cde-4ac5-8d8c-a62d0c057c00" (YardPass Official)

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧪 TEST THE FLASHBACK EVENT:
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. Copy the returned 'id' (UUID)
-- 2. Visit: https://yardpass.tech/e/<id>
-- 
-- YOU SHOULD SEE:
-- ✅ Purple flashback banner at the top
-- ✅ Message: "Share your favorite moments from Summer Fest 2024! 📸"
-- ✅ Countdown: "Posting closes in -X days" (expired - event was July 2024)
-- ✅ Event owned by: YardPass Official
--
-- 3. Try posting to the event:
--    ✅ Without media → Error: "Flashback posts require at least one photo or video"
--    ✅ With media but no caption → Works (caption optional)
--    ✅ With 400 char caption → Error: "Flashback captions are limited to 300 characters"
--    ✅ With link in caption → Link auto-stripped
--    ✅ With media + short caption → Success! ✅
--
-- 4. Check main feed (/)
--    ✅ Your flashback post appears with purple "Flashback" badge
--    ✅ Event card does NOT appear (filtered out from feed)
--
-- 5. Visit organization page (/org/9398c599-4cde-4ac5-8d8c-a62d0c057c00)
--    ✅ Flashback event appears in events list
--    ✅ Has "Flashback" badge

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🎯 NOTE: 90-Day Window
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Event ended: July 17, 2024
-- 90-day window closed: October 15, 2024
-- Today: November 3, 2025
-- Status: ❌ EXPIRED (posting closed)
--
-- To test posting, you can:
-- A) Create a more recent past event (e.g., August 2025)
-- B) Manually update flashback_end_date to future:
--    UPDATE events.events 
--    SET flashback_end_date = now() + interval '30 days'
--    WHERE id = '<event_id>';

