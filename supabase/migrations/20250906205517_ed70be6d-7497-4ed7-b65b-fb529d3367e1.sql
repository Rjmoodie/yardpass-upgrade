-- Create guest_codes table for host-issued access codes
CREATE TABLE public.guest_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  tier_id UUID,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE public.guest_codes ENABLE ROW LEVEL SECURITY;

-- Hosts can manage codes for their events
CREATE POLICY "guest_codes_manage_host" 
ON public.guest_codes 
FOR ALL 
USING (is_event_manager(event_id))
WITH CHECK (is_event_manager(event_id));

-- Anyone can select codes for validation (but we'll validate in edge function)
CREATE POLICY "guest_codes_validate_public" 
ON public.guest_codes 
FOR SELECT 
USING (true);

-- Add index for code lookups
CREATE INDEX idx_guest_codes_code ON public.guest_codes(code);
CREATE INDEX idx_guest_codes_event ON public.guest_codes(event_id);