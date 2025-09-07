// Deno Deploy / Supabase Edge Function
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function cors(res: Response) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return new Response(res.body, { status: res.status, headers: h });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return cors(new Response(null, { status: 204 }));
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return cors(new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401 }));
    }

    // Fetch the user's active tickets + event + tier badge
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        id,
        event_id,
        tier_id,
        status,
        qr_code,
        created_at,
        redeemed_at,
        order_id,
        events (
          id,
          title,
          start_at,
          end_at,
          venue,
          city,
          cover_image_url,
          timezone
        ),
        ticket_tiers (
          id,
          name,
          badge_label,
          price_cents
        ),
        orders (
          created_at
        )
      `)
      .eq("owner_user_id", user.id)
      .in("status", ["issued", "transferred", "redeemed"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("get-user-tickets select error:", error);
      return cors(new Response(JSON.stringify({ error: error.message }), { status: 400 }));
    }

    return cors(new Response(JSON.stringify({ tickets: data }), { status: 200 }));
  } catch (e) {
    console.error("get-user-tickets fatal:", e);
    return cors(new Response(JSON.stringify({ error: e?.message ?? "unknown_error" }), { status: 500 }));
  }
});