-- =====================================================
-- COPY SPONSORS TO SPONSORSHIP SCHEMA
-- =====================================================

-- Check what schemas exist
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('public', 'sponsorship');

-- Check if sponsorship.sponsors table exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'sponsorship' 
  AND table_name = 'sponsors'
) as sponsorship_sponsors_exists;

-- If it exists, copy data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sponsorship' 
    AND table_name = 'sponsors'
  ) THEN
    -- Copy sponsors from public to sponsorship schema
    INSERT INTO sponsorship.sponsors (id, name, logo_url, website_url, description, industry, company_size)
    SELECT id, name, logo_url, website_url, description, industry, company_size
    FROM public.sponsors
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      logo_url = EXCLUDED.logo_url;
    
    RAISE NOTICE 'Copied % sponsors to sponsorship schema', (SELECT COUNT(*) FROM public.sponsors);
  ELSE
    RAISE NOTICE 'sponsorship.sponsors table does not exist - FK probably points to public.sponsors';
  END IF;
END $$;

-- Check both locations
SELECT 'public.sponsors' as location, COUNT(*) FROM public.sponsors
UNION ALL
SELECT 'sponsorship.sponsors (if exists)', 
  COALESCE((SELECT COUNT(*) FROM sponsorship.sponsors), 0);

