import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";
import { generateSecretToken } from "../_shared/crypto.ts";
import React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { RoleInviteEmail } from './_templates/role-invite.tsx'

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

    // 🔒 SECURITY FIX: Generate secure token using standardized crypto utility
    // Uses 256 bits of entropy (sufficient for invite tokens)
    const token = generateSecretToken(32); // 32 bytes = 256 bits = 64 hex chars
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

    // 🔒 SECURITY FIX: Check if user is authorized to send invites for this event
    const { data: isManager, error: authCheckError } = await supabase
      .rpc('is_event_manager', { p_event_id: event_id });

    if (authCheckError) {
      console.error("Authorization check error:", authCheckError);
      return createErrorResponse("Authorization check failed", 500);
    }

    if (!isManager) {
      console.warn(`Unauthorized invite attempt by user ${user.id} for event ${event_id}`);
      return createErrorResponse("Unauthorized: Only event managers can send invites", 403);
    }

    // 🔒 SECURITY FIX: Rate limiting check
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    
    // Check user rate limit (50/hour)
    const { data: userInvites, error: userLimitError } = await supabase
      .from('role_invites')
      .select('id', { count: 'exact', head: true })
      .eq('invited_by', user.id)
      .gte('created_at', oneHourAgo);

    if (!userLimitError && userInvites && userInvites.length >= 50) {
      return createErrorResponse("Rate limit exceeded: Maximum 50 invites per hour", 429);
    }

    // Check event rate limit (20/hour)
    const { data: eventInvites, error: eventLimitError } = await supabase
      .from('role_invites')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id)
      .gte('created_at', oneHourAgo);

    if (!eventLimitError && eventInvites && eventInvites.length >= 20) {
      return createErrorResponse("Rate limit exceeded: Maximum 20 invites per hour for this event", 429);
    }

    // Insert invite using service role
    const { data: inviteData, error: insertError } = await supabase
      .from("role_invites")
      .insert({
        event_id,
        role,
        email: email || null,
        phone: phone || null,
        token,
        expires_at,
        invited_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return createErrorResponse(insertError.message, 400);
    }

    // 🔒 AUDIT LOG: Record invite sent
    try {
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'role_invite_sent',
        resource_type: 'role_invite',
        resource_id: inviteData.id,
        metadata: {
          event_id,
          role,
          recipient_email: email,
          recipient_phone: phone,
          expires_at
        }
      });
    } catch (auditError) {
      console.warn("Failed to log to audit trail:", auditError);
      // Don't fail the request if audit logging fails
    }

    // Get event details for the invitation
    const { data: event } = await supabase
      .from("events")
      .select("title, start_at")
      .eq("id", event_id)
      .single();

    const eventTitle = event?.title || "Event";
    const eventDate = event?.start_at 
      ? new Date(event.start_at).toLocaleDateString('en-US', { 
          month: 'numeric', 
          day: 'numeric', 
          year: 'numeric' 
        })
      : "TBA";
    
    const link = `${req.headers.get("origin") || "https://app.yardpass.app"}/roles/accept?token=${token}`;

    // Send email if provided and Resend is configured
    if (email && RESEND_API_KEY) {
      try {
        // Extract first name from email if not provided
        const first_name = email.split('@')[0].split('.')[0].charAt(0).toUpperCase() + 
                          email.split('@')[0].split('.')[0].slice(1);

        // Render the React Email template
        const html = await renderAsync(
          React.createElement(RoleInviteEmail, {
            first_name,
            event_title: eventTitle,
            event_date: eventDate,
            role,
            invite_link: link,
            expires_in_hours,
          })
        );

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "YardPass <noreply@yardpass.tech>",
            to: [email],
            subject: `Lend a hand at ${eventTitle}?`,
            html,
            reply_to: "support@yardpass.tech",
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
