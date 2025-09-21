-- Add performance index for events by visibility and start time
CREATE INDEX IF NOT EXISTS idx_events_visibility_start_at ON events(visibility, start_at);