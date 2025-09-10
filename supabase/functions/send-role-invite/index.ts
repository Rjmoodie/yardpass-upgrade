import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { event_id, role, email, phone, expires_in_hours = 72 } = await req.json();

    if (!event_id || !role) {
      return createErrorResponse("Missing event_id or role", 400);
    }

    if (!email && !phone) {
      return createErrorResponse("Must provide email or phone", 400);
    }

    // Generate secure token
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const expires_at = new Date(Date.now() + expires_in_hours * 3600_000).toISOString();

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse("Authorization required", 401);
    }

    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return createErrorResponse("Invalid auth token", 401);
    }

    // Insert invite using service role
    const { error: insertError } = await supabase
      .from("role_invites")
      .insert({
        event_id,
        role,
        email: email || null,
        phone: phone || null,
        token,
        expires_at,
        invited_by: user.id,
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return createErrorResponse(insertError.message, 400);
    }

    // Get event details for the invitation
    const { data: event } = await supabase
      .from("events")
      .select("title, start_at")
      .eq("id", event_id)
      .single();

    const eventTitle = event?.title || "Event";
    const link = `${req.headers.get("origin") || "https://app.yardpass.app"}/roles/accept?token=${token}`;

    // Send email if provided and Resend is configured
    if (email && RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "YardPass <noreply@yardpass.app>",
            to: [email],
            subject: `You're invited as ${role} for ${eventTitle}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1>You're invited!</h1>
                <p>You've been invited as <strong>${role}</strong> for the event: <strong>${eventTitle}</strong></p>
                <p>
                  <a href="${link}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Accept Invitation
                  </a>
                </p>
                <p><small>This invitation expires in ${expires_in_hours} hours.</small></p>
                <p><small>If the button doesn't work, copy and paste this link: ${link}</small></p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error("Email send error:", emailError);
      }
    }

    // Send SMS if provided and Twilio is configured
    if (phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
      try {
        const body = new URLSearchParams({
          To: phone,
          From: TWILIO_FROM_NUMBER,
          Body: `You're invited as ${role} for ${eventTitle}. Accept: ${link}`,
        });

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });
      } catch (smsError) {
        console.error("SMS send error:", smsError);
      }
    }

    return createResponse({ success: true, token });
  } catch (error) {
    console.error("Function error:", error);
    return createErrorResponse(String(error), 500);
  }
});