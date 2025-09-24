import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function renderHtml(userName: string, recs: any[]) {
  const items = recs.map(r => `
    <tr>
      <td style="padding:10px 0;">
        <div style="font-weight:600">${r.title}</div>
        <div style="font-size:12px;color:#666">
          ${r.starts_at ? new Date(r.starts_at).toLocaleString() : ""} ·
          ${r.category ?? ""} ${r.distance_km ? `· ${r.distance_km.toFixed(1)} km` : ""}
        </div>
        <div>
          <a href="${Deno.env.get("APP_ORIGIN") || "https://yardpass.app"}/e/${r.event_id}" style="display:inline-block;margin-top:6px;padding:8px 12px;background:#111;color:#fff;border-radius:6px;text-decoration:none">View event</a>
        </div>
      </td>
    </tr>
  `).join("");

  return `
  <div style="font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;max-width:640px;margin:auto">
    <h2>Events picked for you${userName ? `, ${userName}` : ""}</h2>
    <p>Here's what's coming up near you.</p>
    <table width="100%">${items}</table>
    <p style="font-size:12px;color:#999">You can manage preferences in your account.</p>
  </div>`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, reason } = await req.json(); // reason: "weekly_digest" | "ticket_intent"
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user profile with email
    const { data: userRow, error: ue } = await supabase
      .from("user_profiles")
      .select("user_id, email, display_name")
      .eq("user_id", userId)
      .single();

    if (ue || !userRow?.email) {
      console.log(`No email found for user ${userId}`);
      return new Response("No email", { status: 204 });
    }

    // Get recommendations for user
    const { data: recs, error: er } = await supabase.rpc("get_recommendations", { 
      p_user: userId, 
      p_limit: 5 
    });

    if (er) throw er;
    if (!recs?.length) {
      console.log(`No recommendations found for user ${userId}`);
      return new Response("No recs", { status: 204 });
    }

    const html = await renderHtml(userRow.display_name ?? "", recs);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "YardPass <updates@yardpass.app>",
        to: [userRow.email],
        subject: reason === "ticket_intent" ? "Still thinking about these?" : "Your weekly picks",
        html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`);
    }

    console.log(`Successfully sent ${reason} email to ${userRow.email}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error in send-digest function:', e);
    return new Response(
      JSON.stringify({ error: (e as any).message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});