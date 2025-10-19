-- Remove safety talks system (accidentally added)
-- These tables are isolated and don't affect core functionality

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.safety_signoffs CASCADE;
DROP TABLE IF EXISTS public.safety_talk_schedule CASCADE;
DROP TABLE IF EXISTS public.safety_talk_assets CASCADE;
DROP TABLE IF EXISTS public.safety_talks CASCADE;

-- Note: No data loss concerns as these were accidentally added
-- and don't connect to core event/ticketing/social functionality
