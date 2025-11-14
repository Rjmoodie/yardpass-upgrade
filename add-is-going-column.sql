-- Add is_going column to saved_events table for RSVP functionality
-- This allows users to mark events they're interested in attending

-- Check if column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'saved_events' 
        AND column_name = 'is_going'
    ) THEN
        ALTER TABLE saved_events 
        ADD COLUMN is_going BOOLEAN DEFAULT false;
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_saved_events_going 
        ON saved_events(event_id, is_going) 
        WHERE is_going = true;
        
        COMMENT ON COLUMN saved_events.is_going IS 'Indicates user has marked they are going/interested in attending';
    END IF;
END $$;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON saved_events TO authenticated, anon;

-- Update RLS policies if needed
-- (Assuming RLS already allows users to manage their own saved events)


