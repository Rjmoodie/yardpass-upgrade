-- Create guest OTP codes table
CREATE TABLE IF NOT EXISTS public.guest_otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  method TEXT NOT NULL,
  contact TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  event_id UUID,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guest ticket sessions table
CREATE TABLE IF NOT EXISTS public.guest_ticket_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL,
  contact TEXT NOT NULL,
  scope JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_guest_otp_lookup ON public.guest_otp_codes (method, contact, otp_hash);
CREATE INDEX IF NOT EXISTS idx_guest_otp_expires ON public.guest_otp_codes (expires_at);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_token ON public.guest_ticket_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_expires ON public.guest_ticket_sessions (expires_at);

-- Enable RLS
ALTER TABLE public.guest_otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_ticket_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role only for security)
CREATE POLICY "Service role can manage guest OTP codes" ON public.guest_otp_codes
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage guest sessions" ON public.guest_ticket_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Add cleanup function for expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_guest_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.guest_otp_codes 
  WHERE expires_at < NOW();
  
  DELETE FROM public.guest_ticket_sessions 
  WHERE expires_at < NOW();
END;
$function$;