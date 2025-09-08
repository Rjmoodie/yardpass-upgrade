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
    const { method, contact, event_id } = await req.json();

    if (!method || !contact) {
      return createErrorResponse('Missing method or contact', 400);
    }

    if (!['phone', 'email'].includes(method)) {
      return createErrorResponse('Invalid method. Must be phone or email', 400);
    }

    // Rate limiting check
    const rateLimitKey = `guest-otp:${method}:${contact}`;
    const { data: rateLimit } = await supabase
      .from('rate_limits')
      .select('count')
      .eq('bucket', rateLimitKey)
      .eq('minute', new Date(Math.floor(Date.now() / 60000) * 60000).toISOString())
      .single();

    if (rateLimit && rateLimit.count >= 3) {
      return createErrorResponse('Too many requests. Please try again later.', 429);
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(otp + contact))
      .then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Store OTP with 5-minute expiry
    const expiry = new Date(Date.now() + 5 * 60 * 1000);
    await supabase
      .from('guest_otp_codes')
      .upsert({
        method,
        contact,
        otp_hash: otpHash,
        event_id,
        expires_at: expiry.toISOString(),
        created_at: new Date().toISOString()
      });

    // Update rate limit
    await supabase
      .from('rate_limits')
      .upsert({
        bucket: rateLimitKey,
        user_id: '00000000-0000-0000-0000-000000000000', // dummy UUID for guest
        minute: new Date(Math.floor(Date.now() / 60000) * 60000).toISOString(),
        count: (rateLimit?.count || 0) + 1
      });

    // Send OTP (mock for now - integrate with SMS/email service)
    console.log(`OTP for ${contact}: ${otp}`);

    // In production, integrate with SMS/email service here
    if (method === 'email') {
      // Send email with OTP
      console.log(`Would send email to ${contact} with OTP: ${otp}`);
    } else {
      // Send SMS with OTP
      console.log(`Would send SMS to ${contact} with OTP: ${otp}`);
    }

    return createResponse({ success: true, message: 'OTP sent successfully' });

  } catch (error) {
    console.error('Error in guest-tickets-start:', error);
    return createErrorResponse('Internal server error', 500);
  }
})