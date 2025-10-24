import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors, createResponse, createErrorResponse } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { method, contact, otp, event_id } = await req.json();

    if (!method || !contact || !otp) {
      return createErrorResponse('Missing method, contact, or otp', 400);
    }

    // Hash the provided OTP
    const otpHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(otp + contact))
      .then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Verify OTP
    const { data: otpRecord, error: otpError } = await supabase
      .from('guest_otp_codes')
      .select('*')
      .eq('method', method)
      .eq('contact', contact)
      .eq('otp_hash', otpHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (otpError || !otpRecord) {
      return createErrorResponse('Invalid or expired OTP', 400);
    }

    // Generate session token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
      .then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Define scope
    const scope = event_id ? { eventIds: [event_id] } : { all: true };
    const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store session
    await supabase
      .from('guest_ticket_sessions')
      .insert({
        token_hash: tokenHash,
        method,
        contact,
        scope: scope,
        expires_at: expiry.toISOString(),
        created_at: new Date().toISOString()
      });

    // Clean up OTP
    await supabase
      .from('guest_otp_codes')
      .delete()
      .eq('method', method)
      .eq('contact', contact);

    return createResponse({
      token,
      scope,
      expires_at: expiry.getTime(),
      [method]: contact
    });

  } catch (error) {
    console.error('Error in guest-tickets-verify:', error);
    return createErrorResponse('Internal server error', 500);
  }
})