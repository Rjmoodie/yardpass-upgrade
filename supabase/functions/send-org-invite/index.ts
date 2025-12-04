import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Inline CORS helper to avoid import path issues
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const withCORS = <T extends (req: Request) => Promise<Response> | Response>(handler: T) =>
  async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    const res = await handler(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  };

// Service role client for elevated database operations
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const handler = withCORS(async (req) => {
  try {
    const { org_id, email, role = 'viewer', expires_in_hours = 168 } = await req.json();

    if (!org_id || !email) {
      return new Response(JSON.stringify({ error: "Missing org_id or email" }), { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), { status: 400 });
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), { status: 400 });
    }

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), { status: 401 });
    }

    // Create supabase client with user's auth token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth token" }), { status: 401 });
    }

    // Check if user has permission to invite to this organization
    const { data: membership, error: membershipError } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: "Not a member of this organization" }), { status: 403 });
    }

    // Only owners and admins can invite members
    if (!['owner', 'admin'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions to invite members" }), { status: 403 });
    }

    // Check if user is already a member (use admin client for cross-table queries)
    const { data: userProfile } = await supabaseAdmin.from("user_profiles").select("user_id").eq("email", email).single();
    if (userProfile) {
      const { data: existingMember } = await supabaseAdmin
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", org_id)
        .eq("user_id", userProfile.user_id)
        .single();

      if (existingMember) {
        return new Response(JSON.stringify({ error: "User is already a member of this organization" }), { status: 400 });
      }
    }

    // Generate secure token
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const expires_at = new Date(Date.now() + expires_in_hours * 3600_000).toISOString();

    // Get organization details (use admin client for cross-table access)
    const { data: organization, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("name, description")
      .eq("id", org_id)
      .single();

    if (orgError || !organization) {
      return new Response(JSON.stringify({ error: "Organization not found" }), { status: 404 });
    }

    // Insert invite (use admin client for elevated permissions)
    const { data: invite, error: insertError } = await supabaseAdmin
      .from("org_invitations")
      .insert({
        org_id,
        email,
        role,
        token,
        expires_at,
        invited_by: user.id,
        status: 'pending',
        email_status: 'pending', // Track email delivery status
        metadata: {
          invited_at: new Date().toISOString(),
          inviter_email: user.email,
          expires_in_hours
        }
      })
      .select("id, token")
      .single();

    if (insertError) {
      console.error("[INVITE-ERROR] Failed to create invite:", {
        org_id,
        email,
        role,
        error: insertError.message,
        code: insertError.code
      });
      return new Response(JSON.stringify({ error: insertError.message }), { status: 400 });
    }

    console.log("[INVITE-CREATED]", {
      invite_id: invite.id,
      org_id,
      email,
      role,
      expires_at,
      invited_by: user.id
    });

    // Send email invitation
    let emailSent = false;
    let emailError = null;
    let emailId = null;

    if (RESEND_API_KEY) {
      const inviteLink = `${req.headers.get("origin") || "https://liventix.tech"}/invite/org?token=${token}`;
      
      console.log("[INVITE-EMAIL] Preparing to send:", {
        invite_id: invite.id,
        to: email,
        org_name: organization.name,
        invite_link: inviteLink
      });

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation to join ${organization.name}</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: white;
            }
            .logo-section {
              text-align: center;
              padding: 30px 20px 20px;
              background: white;
            }
            .logo-section img {
              width: 100px;
              height: auto;
              max-width: 100%;
              border-radius: 12px;
            }
            .header { 
              background: #fafafa;
              border: 1px solid #e2e8f0;
              color: #0f172a; 
              padding: 30px 20px; 
              text-align: center;
              border-radius: 14px 14px 0 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content { 
              background: white; 
              padding: 40px 30px;
            }
            .content p {
              margin: 0 0 16px 0;
              color: #333;
            }
            .button { 
              display: inline-block; 
              background: #0f172a;
              color: white !important; 
              padding: 14px 32px; 
              text-decoration: none; 
              border-radius: 8px; 
              margin: 24px 0;
              font-weight: 600;
            }
            .button:hover {
              background: #1e293b;
            }
            .info-text {
              color: #64748b;
              font-size: 14px;
              margin-top: 20px;
            }
            .footer { 
              text-align: center; 
              padding: 30px 20px;
              background: #f8fafc;
              color: #64748b; 
              font-size: 14px;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo-section">
              <img src="https://yieslxnrfeqchbcmgavz.supabase.co/storage/v1/object/public/Liventix%20Official/org-images/logo.png" alt="Liventix" width="100" style="width:100px;height:auto;max-width:100%;border-radius:12px;" />
              <p style="margin:12px 0 0 0;color:#94a3b8;font-size:14px;letter-spacing:0.5px;">Live Event Tickets</p>
            </div>
            <div class="header">
              <h1>You're invited to join ${organization.name}</h1>
            </div>
            <div class="content">
              <p>Hello!</p>
              <p>You've been invited to join <strong>${organization.name}</strong> on Liventix as a <strong>${role}</strong>.</p>
              ${organization.description ? `<p style="color: #64748b; font-style: italic;">${organization.description}</p>` : ''}
              <p>Click the button below to accept your invitation:</p>
              <div style="text-align: center;">
                <a href="${inviteLink}" class="button">Accept Invitation</a>
              </div>
              <p class="info-text">This invitation will expire in ${expires_in_hours} hours.</p>
              <p class="info-text">If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p><strong>Liventix</strong> - Live Event Tickets</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: "Liventix <hello@liventix.tech>",
            to: [email],
            subject: `You're invited to join ${organization.name} on Liventix`,
            html: emailHtml,
            tags: [
              { name: 'type', value: 'org_invite' },
              { name: 'org_id', value: org_id },
              { name: 'invite_id', value: invite.id }
            ]
          }),
        });

        const emailData = await emailResponse.json();

        if (emailResponse.ok) {
          emailSent = true;
          emailId = emailData.id;
          
          console.log("[INVITE-EMAIL-SUCCESS]", {
            invite_id: invite.id,
            email_id: emailId,
            to: email,
            org_name: organization.name
          });

          // Update invite with email success status
          await supabaseAdmin
            .from("org_invitations")
            .update({
              email_status: 'sent',
              email_sent_at: new Date().toISOString(),
              metadata: {
                invited_at: new Date().toISOString(),
                inviter_email: user.email,
                expires_in_hours,
                email_id: emailId,
                email_provider: 'resend'
              }
            })
            .eq("id", invite.id);

        } else {
          emailError = emailData.message || JSON.stringify(emailData);
          
          console.error("[INVITE-EMAIL-FAILED]", {
            invite_id: invite.id,
            to: email,
            status_code: emailResponse.status,
            error: emailError,
            response: emailData
          });

          // Update invite with email failure status
          await supabaseAdmin
            .from("org_invitations")
            .update({
              email_status: 'failed',
              metadata: {
                invited_at: new Date().toISOString(),
                inviter_email: user.email,
                expires_in_hours,
                email_error: emailError,
                email_failed_at: new Date().toISOString()
              }
            })
            .eq("id", invite.id);
        }
      } catch (err) {
        emailError = err.message || String(err);
        
        console.error("[INVITE-EMAIL-ERROR]", {
          invite_id: invite.id,
          to: email,
          error: emailError,
          stack: err.stack
        });

        // Update invite with email error status
        await supabaseAdmin
          .from("org_invitations")
          .update({
            email_status: 'error',
            metadata: {
              invited_at: new Date().toISOString(),
              inviter_email: user.email,
              expires_in_hours,
              email_error: emailError,
              email_error_at: new Date().toISOString()
            }
          })
          .eq("id", invite.id);
      }
    } else {
      console.warn("[INVITE-EMAIL-SKIPPED] No RESEND_API_KEY configured", {
        invite_id: invite.id,
        to: email
      });

      // Update invite to indicate email was not sent (no API key)
      await supabaseAdmin
        .from("org_invitations")
        .update({
          email_status: 'no_config',
          metadata: {
            invited_at: new Date().toISOString(),
            inviter_email: user.email,
            expires_in_hours,
            email_skipped_reason: 'no_resend_api_key'
          }
        })
        .eq("id", invite.id);
    }

    console.log("[INVITE-COMPLETE]", {
      invite_id: invite.id,
      email_sent: emailSent,
      email_id: emailId,
      has_error: !!emailError
    });

    return new Response(JSON.stringify({
      success: true,
      invite_id: invite.id,
      email_sent: emailSent,
      email_id: emailId,
      email_error: emailError,
      message: emailSent 
        ? "Invitation sent successfully" 
        : `Invitation created but email ${emailError ? 'failed: ' + emailError : 'was not sent'}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Error in send-org-invite:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});

serve(handler);
