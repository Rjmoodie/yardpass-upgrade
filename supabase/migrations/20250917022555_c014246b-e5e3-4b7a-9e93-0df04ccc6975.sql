-- Add missing session_id column to analytics_events table
ALTER TABLE public.analytics_events 
ADD COLUMN IF NOT EXISTS session_id TEXT;