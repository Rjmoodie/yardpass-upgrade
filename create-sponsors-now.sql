-- =====================================================
-- CREATE SPONSORS NOW (If seed data didn't work)
-- =====================================================

-- Check if sponsors exist
SELECT COUNT(*) as sponsor_count FROM sponsors;

-- Create the 3 sample sponsors
INSERT INTO public.sponsors (
  id, 
  name, 
  logo_url, 
  website_url, 
  description,
  industry,
  company_size,
  brand_values
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001'::uuid, 
    'TechCorp Industries', 
    'https://api.dicebear.com/7.x/initials/svg?seed=TechCorp', 
    'https://techcorp.example.com',
    'Leading technology solutions for enterprise clients',
    'Technology',
    'enterprise',
    '{"innovation": true, "reliability": true, "cutting_edge": true}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000002'::uuid, 
    'GreenEarth Solutions', 
    'https://api.dicebear.com/7.x/initials/svg?seed=GreenEarth', 
    'https://greenearth.example.com',
    'Sustainable products and eco-friendly solutions',
    'Sustainability',
    'mid_market',
    '{"eco_friendly": true, "community": true, "transparency": true}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000003'::uuid, 
    'Athletic Pro Gear', 
    'https://api.dicebear.com/7.x/initials/svg?seed=AthleticPro', 
    'https://athleticpro.example.com',
    'Premium athletic equipment and sportswear',
    'Sports & Fitness',
    'mid_market',
    '{"performance": true, "quality": true, "athlete_endorsed": true}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- Verify they were created
SELECT id, name, industry FROM sponsors;

-- Now run the create-sponsored-event.sql script!

