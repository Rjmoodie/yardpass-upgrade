-- Create a future test event so tickets show as upcoming
INSERT INTO events (
  id,
  title, 
  description,
  start_at,
  end_at,
  venue,
  city,
  country,
  timezone,
  cover_image_url,
  category,
  visibility,
  owner_context_type,
  owner_context_id,
  created_by
) VALUES (
  gen_random_uuid(),
  'Test Future Event 2025',
  'A test event to verify ticket display',
  '2025-12-31 20:00:00+00',
  '2025-12-31 23:00:00+00', 
  'Test Venue',
  'Test City',
  'USA',
  'America/New_York',
  'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3',
  'music',
  'public',
  'individual',
  '34cce931-f181-4caf-8f05-4bcc7ee3ecaa',
  '34cce931-f181-4caf-8f05-4bcc7ee3ecaa'
) ON CONFLICT DO NOTHING;