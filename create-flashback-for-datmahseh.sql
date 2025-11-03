-- Create Test Flashback Event for datmahseh@gmail.com
-- User ID: 86289a38-799e-4e76-b3dd-2f9615e56afa
-- Ready to run - no edits needed!

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
  '86289a38-799e-4e76-b3dd-2f9615e56afa',  -- datmahseh@gmail.com
  'individual',
  '86289a38-799e-4e76-b3dd-2f9615e56afa',  -- datmahseh@gmail.com
  true,                                     -- is_flashback = true
  'Share your favorite moments from Summer Fest 2024! 📸 Upload your photos and videos to help us build excitement for this year''s event.',
  'public',
  'Central Park Main Stage',
  '1234 Park Avenue South',
  'New York City',
  'United States',
  'Music',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200',  -- Festival crowd image
  40.7829,  -- Central Park coordinates
  -73.9654
) RETURNING 
  id, 
  title, 
  is_flashback, 
  flashback_end_date,
  slug;

-- ✅ After running, you'll see:
-- • id: <event_uuid>
-- • title: "Summer Music Festival 2024 (Flashback)"
-- • is_flashback: true
-- • flashback_end_date: 2024-10-15 23:00:00 (auto-calculated: end_at + 90 days)
-- • slug: null (will be auto-generated on first access)

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- NEXT: Test the flashback event
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. Copy the returned 'id' (UUID)
-- 2. Visit: https://yardpass.tech/e/<id>
-- 3. You should see:
--    ✅ Purple flashback banner at top
--    ✅ "Share your favorite moments..." message
--    ✅ Countdown showing days remaining
-- 4. Try posting:
--    ✅ Without media → Error (media required)
--    ✅ With 400 char caption → Error (300 max)
--    ✅ With media + short caption → Success!
-- 5. Check main feed:
--    ✅ Your post appears with flashback badge
--    ✅ Event card does NOT appear (filtered out)

