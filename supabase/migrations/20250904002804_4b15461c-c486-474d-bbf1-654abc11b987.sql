-- Create sample data for analytics testing

-- Insert sample organization
INSERT INTO public.organizations (id, name, handle, created_by) 
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'YardPass Demo Events',
  'yardpass-demo',
  (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT (id) DO NOTHING;

-- Insert sample events
INSERT INTO public.events (id, title, description, owner_context_type, owner_context_id, created_by, start_at, end_at, venue, city, country, category, visibility)
VALUES 
  (
    'b2c3d4e5-f6g7-8901-bcde-f23456789012'::uuid,
    'Summer Music Festival 2024',
    'Amazing outdoor music festival',
    'organization',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    (SELECT id FROM auth.users LIMIT 1),
    '2024-07-15 18:00:00+00',
    '2024-07-15 23:00:00+00',
    'Central Park',
    'New York',
    'USA',
    'Music',
    'public'
  ),
  (
    'c3d4e5f6-g7h8-9012-cdef-345678901234'::uuid,
    'Tech Conference 2024',
    'Latest in technology trends',
    'organization', 
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    (SELECT id FROM auth.users LIMIT 1),
    '2024-08-20 09:00:00+00',
    '2024-08-20 17:00:00+00',
    'Convention Center',
    'San Francisco',
    'USA',
    'Technology',
    'public'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert sample ticket tiers
INSERT INTO public.ticket_tiers (id, event_id, name, price_cents, quantity, max_per_order, status)
VALUES
  ('d4e5f6g7-h8i9-0123-def4-56789012345'::uuid, 'b2c3d4e5-f6g7-8901-bcde-f23456789012'::uuid, 'General Admission', 5000, 500, 6, 'active'),
  ('e5f6g7h8-i9j0-1234-efg5-67890123456'::uuid, 'b2c3d4e5-f6g7-8901-bcde-f23456789012'::uuid, 'VIP', 15000, 100, 4, 'active'),
  ('f6g7h8i9-j0k1-2345-fgh6-78901234567'::uuid, 'c3d4e5f6-g7h8-9012-cdef-345678901234'::uuid, 'Standard', 25000, 200, 5, 'active'),
  ('g7h8i9j0-k1l2-3456-ghi7-89012345678'::uuid, 'c3d4e5f6-g7h8-9012-cdef-345678901234'::uuid, 'Premium', 50000, 50, 3, 'active')
ON CONFLICT (id) DO NOTHING;