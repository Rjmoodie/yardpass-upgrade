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

    // Send OTP via email or SMS
    if (method === 'email') {
      // Send email with OTP using Resend API
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_API_KEY) {
        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'YardPass <noreply@yardpass.tech>',
              to: [contact],
              subject: 'Your YardPass Access Code',
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #10b981; margin: 0;">🎫 YardPass</h1>
                    <h2 style="color: #374151; margin: 10px 0;">Access Your Tickets</h2>
                  </div>
                  
                  <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 15px 0; color: #374151;">Your verification code is:</p>
                    <div style="background: #10b981; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 15px; border-radius: 8px; letter-spacing: 5px; margin: 15px 0;">
                      ${otp}
                    </div>
                    <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 14px;">
                      This code expires in 5 minutes. Enter it in the YardPass app to access your tickets.
                    </p>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                    If you didn't request this code, you can safely ignore this email.
                  </p>
                </div>
              `,
            }),
          });

          if (!emailResponse.ok) {
            console.error('Failed to send email:', await emailResponse.text());
          } else {
            console.log(`OTP email sent to ${contact}`);
          }
        } catch (emailError) {
          console.error('Email sending error:', emailError);
        }
      } else {
        console.log(`OTP for ${contact}: ${otp} (RESEND_API_KEY not configured)`);
      }
    } else {
      // Send SMS with OTP (placeholder for SMS service integration)
      console.log(`Would send SMS to ${contact} with OTP: ${otp}`);
    }

    return createResponse({ success: true, message: 'OTP sent successfully' });

  } catch (error) {
    console.error('Error in guest-tickets-start:', error);
    return createErrorResponse('Internal server error', 500);
  }
})