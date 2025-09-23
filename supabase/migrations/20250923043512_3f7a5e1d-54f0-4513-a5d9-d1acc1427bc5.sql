-- Drop the old version of get_home_feed_v2 that has uuid cursor_id parameter
DROP FUNCTION IF EXISTS get_home_feed_v2(uuid, integer, timestamptz, uuid);

-- Ensure we only have the correct version with text cursor_id parameter
-- This function was already created in the previous migration