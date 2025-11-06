// supabase/functions/auth-send-otp/index.ts
// Auth OTP via Resend - for guest checkout reaccess

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

// Generate 6-digit OTP
const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

const hashOtp = async (otp: string, email: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp + email.toLowerCase().trim());
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[auth-send-otp] Missing Supabase env vars");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { email } = await req.json().catch(() => ({} as any));

    if (!email || typeof email !== "string") {
      return json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const otp = generateOTP();
    const otpHash = await hashOtp(otp, normalizedEmail);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    console.log(`[auth-send-otp] Generated OTP: ${otp} for ${normalizedEmail}`);

    const { error: dbError } = await supabase
      .from("guest_otp_codes")
      .upsert({
        method: "email",
        contact: normalizedEmail,
        otp_hash: otpHash,
        event_id: null,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error("[auth-send-otp] DB error:", dbError);
      return json({ error: "Failed to store OTP" }, { status: 500 });
    }

    // Send email via Resend if configured
    if (RESEND_API_KEY) {
      try {
        const emailHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>YardPass Verification Code</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding:32px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">
            <!-- Header -->
            <tr>
              <td align="center" style="background:linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding:32px;">
                <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">YardPass</h1>
                <p style="margin:8px 0 0 0; color:rgba(255,255,255,0.9); font-size:15px;">
                  Your gateway to events and culture
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 12px 0; font-size:20px; font-weight:700; color:#1e293b;">
                  Access Your Tickets
                </h2>
                <p style="margin:0 0 24px 0; color:#475569; font-size:15px; line-height:1.6;">
                  Enter this verification code to sign in and access your tickets:
                </p>

                <!-- OTP Block (table-based) -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                  <tr>
                    <td align="center">
                      <table cellpadding="0" cellspacing="0" style="background:#6366f1; border-radius:14px;">
                        <tr>
                          <td style="padding:24px; text-align:center;">
                            <div style="font-size:32px; font-weight:800; color:#ffffff; letter-spacing:8px; font-family:'Courier New',monospace;">
                              ${otp}
                            </div>
                            <div style="margin-top:12px; font-size:13px; color:rgba(255,255,255,0.85);">
                              Expires in 5 minutes
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Security note -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:18px;">
                      <p style="margin:0; color:#64748b; font-size:13px; line-height:1.6;">
                        For security, never share this code with anyone. If you didn't request this code, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="background-color:#f8fafc; padding:20px 32px; border-top:1px solid #e2e8f0; color:#94a3b8; font-size:12px;">
                <p style="margin:0 0 6px 0;">© ${new Date().getFullYear()} YardPass. All rights reserved.</p>
                <a href="https://yardpass.tech" style="color:#94a3b8; text-decoration:none;">yardpass.tech</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();

        const textBody = `YardPass - Your Verification Code

Your verification code is: ${otp}

This code expires in 5 minutes.

Enter this code to sign in and access your tickets.

For security, never share this code with anyone.

© ${new Date().getFullYear()} YardPass
yardpass.tech`;

        console.log(`[auth-send-otp] OTP in HTML: ${emailHtml.includes(otp)}, in text: ${textBody.includes(otp)}`);

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "YardPass <hello@yardpass.tech>",
            to: [normalizedEmail],
            subject: "Your YardPass verification code",
            html: emailHtml,
            text: textBody,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error("[auth-send-otp] Resend error:", errorText);
          return json({ error: "Failed to send email" }, { status: 500 });
        }

        console.log(`[auth-send-otp] Email sent to ${normalizedEmail}`);
      } catch (emailError) {
        console.error("[auth-send-otp] Email error:", emailError);
        return json({ error: "Failed to send email" }, { status: 500 });
      }
    } else {
      // Helpful in non-production; optionally guard behind another env var
      console.log(
        `[auth-send-otp] RESEND_API_KEY not configured – OTP for ${normalizedEmail}: ${otp}`,
      );
    }

    return json({ success: true, message: "OTP sent successfully" }, { status: 200 });
  } catch (error) {
    console.error("[auth-send-otp] Error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
});
