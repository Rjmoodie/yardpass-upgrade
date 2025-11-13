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
        status: 'pending'
      })
      .select("id, token")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), { status: 400 });
    }

    // Send email invitation
    if (RESEND_API_KEY) {
      const inviteLink = `${req.headers.get("origin") || "https://app.liventix.app"}/invite/org?token=${token}`;
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invitation to join ${organization.name}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #6366f1; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're invited to join ${organization.name}</h1>
            </div>
            <div class="content">
              <p>Hello!</p>
              <p>You've been invited to join <strong>${organization.name}</strong> on Liventix as a <strong>${role}</strong>.</p>
              ${organization.description ? `<p>${organization.description}</p>` : ''}
              <p>Click the button below to accept your invitation:</p>
              <a href="${inviteLink}" class="button">Accept Invitation</a>
              <p>This invitation will expire in ${expires_in_hours} hours.</p>
              <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>Liventix - Connecting communities through events</p>
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
            from: "Liventix <invites@liventix.app>",
            to: [email],
            subject: `You're invited to join ${organization.name} on Liventix`,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          console.error("Email sending failed:", await emailResponse.text());
        }
      } catch (emailError) {
        console.error("Email sending error:", emailError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      invite_id: invite.id,
      message: "Invitation sent successfully"
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
