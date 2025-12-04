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
    const { error: upsertError } = await supabase
      .from('guest_otp_codes')
      .upsert({
        method,
        contact,
        otp_hash: otpHash,
        event_id,
        expires_at: expiry.toISOString(),
        created_at: new Date().toISOString()
      });

    if (upsertError) {
      console.error('[guest-tickets-start] Failed to store OTP:', upsertError);
      return createErrorResponse('Failed to store OTP code', 500);
    }

    console.log('[guest-tickets-start] OTP stored successfully');

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
              from: 'Liventix <hello@liventix.tech>',
              to: [contact],
              subject: 'Your Liventix Access Code',
              html: `
                <!DOCTYPE html>
                <html lang="en">
                  <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>Liventix Access Code</title>
                  </head>
                  <body style="margin:0; padding:0; background-color:#f4f4f5; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color:#0f172a;">
                    <div style="display:none; overflow:hidden; line-height:1px; max-height:0; max-width:0; opacity:0; color:transparent;">Your Liventix access code is ${otp}. It expires in 5 minutes.</div>
                    <div style="padding:32px 16px; background-color:#f4f4f5;">
                      <div style="max-width:520px; margin:0 auto; background-color:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 18px 30px rgba(15,23,42,0.08);">
                        <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding:28px 32px; text-align:center;">
                          <img src="https://yieslxnrfeqchbcmgavz.supabase.co/storage/v1/object/public/Liventix%20Official/org-images/logo.png" alt="Liventix" width="100" style="width:100px; height:auto; max-width:100%; border-radius:12px; margin-bottom:12px;" />
                          <div style="font-size:13px; color:#94a3b8; letter-spacing:0.08em; text-transform:uppercase;">Secure ticket access</div>
                        </div>
                        <div style="padding:32px;">
                          <div style="text-align:center; margin-bottom:24px;">
                            <h1 style="margin:0; font-size:24px; color:#0f172a;">Access Your Tickets</h1>
                            <p style="margin:8px 0 0 0; color:#475569; font-size:15px;">Use the one-time code below to verify your email and unlock your tickets.</p>
                          </div>
                          <div style="background-color:#fafafa; border:1px solid #e2e8f0; color:#0f172a; border-radius:14px; padding:24px; text-align:center; margin-bottom:24px;">
                            <div style="font-size:14px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.9;">Your secure code</div>
                            <div style="margin-top:12px; font-size:42px; font-weight:700; letter-spacing:12px;">${otp}</div>
                            <div style="margin-top:12px; font-size:13px; opacity:0.85;">Expires in 5 minutes</div>
                          </div>
                          <div style="background-color:#fafafa; border:1px solid #e2e8f0; border-radius:14px; padding:18px; margin-bottom:24px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px; color:#475569;">
                              <tr>
                                <td style="padding-bottom:8px;">1. Enter the code in the Liventix guest portal.</td>
                              </tr>
                              <tr>
                                <td style="padding-bottom:8px;">2. Access, download, or share the tickets assigned to you.</td>
                              </tr>
                              <tr>
                                <td>3. Need help? Reply to this email and our team will assist.</td>
                              </tr>
                            </table>
                          </div>
                          <div style="text-align:center; margin-bottom:16px;">
                            <a href="https://liventix.tech/tickets" style="display:inline-block; background:#0f172a; color:#ffffff; padding:14px 32px; border-radius:12px; text-decoration:none; font-size:15px; font-weight:600;">Open Liventix</a>
                          </div>
                          <p style="margin:0; color:#64748b; font-size:13px; line-height:1.6;">If you didn’t request this code, you can safely ignore this email. For security, never share this code with anyone.</p>
                        </div>
                        <div style="background-color:#f8fafc; padding:20px 32px; border-top:1px solid #e2e8f0; text-align:center; color:#94a3b8; font-size:12px;">
                          <p style="margin:0 0 6px 0;">© ${new Date().getFullYear()} Liventix. All rights reserved.</p>
                          <a href="https://liventix.tech" style="color:#94a3b8; text-decoration:none;">liventix.tech</a>
                        </div>
                      </div>
                    </div>
                  </body>
                </html>
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