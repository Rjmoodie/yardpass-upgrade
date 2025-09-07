// supabase/functions/get-user-tickets/index.ts

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
    if (!authHeader) {
      return cors(new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401 }));
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return cors(new Response(JSON.stringify({ error: "not_authenticated" }), { status: 401 }));
    }

    // Fetch user's tickets (only relevant statuses)
    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("id, event_id, tier_id, order_id, status, qr_code, created_at")
      .eq("owner_user_id", user.id)
      .in("status", ["issued", "transferred", "redeemed"])
      .order("created_at", { ascending: false });

    if (ticketsError) {
      console.error("get-user-tickets tickets error:", ticketsError);
      return cors(new Response(JSON.stringify({ error: ticketsError.message }), { status: 400 }));
    }

    if (!tickets || tickets.length === 0) {
      return cors(new Response(JSON.stringify({ tickets: [] }), { status: 200 }));
    }

    // Collect FK ids
    const eventIds = [...new Set(tickets.map(t => t.event_id))];
    const tierIds = [...new Set(tickets.map(t => t.tier_id))];
    const orderIds = [...new Set(tickets.map(t => t.order_id).filter(Boolean))];

    // Fetch related data (only needed fields)
    const [eventsRes, tiersRes, ordersRes] = await Promise.all([
      supabase
        .from("events")
        .select("id, title, start_at, end_at, timezone, venue, city, cover_image_url, organizer_name")
        .in("id", eventIds),
      supabase
        .from("ticket_tiers")
        .select("id, name, price_cents, badge_label")
        .in("id", tierIds),
      orderIds.length > 0
        ? supabase.from("orders").select("id, created_at").in("id", orderIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (eventsRes.error) {
      console.error("get-user-tickets events error:", eventsRes.error);
      return cors(new Response(JSON.stringify({ error: eventsRes.error.message }), { status: 400 }));
    }
    if (tiersRes.error) {
      console.error("get-user-tickets tiers error:", tiersRes.error);
      return cors(new Response(JSON.stringify({ error: tiersRes.error.message }), { status: 400 }));
    }
    if (ordersRes.error) {
      console.error("get-user-tickets orders error:", ordersRes.error);
      return cors(new Response(JSON.stringify({ error: ordersRes.error.message }), { status: 400 }));
    }

    // Build lookups
    const eventsMap = new Map(eventsRes.data?.map((e: any) => [e.id, e]) || []);
    const tiersMap = new Map(tiersRes.data?.map((t: any) => [t.id, t]) || []);
    const ordersMap = new Map(ordersRes.data?.map((o: any) => [o.id, o]) || []);

    // Enrich
    const enrichedTickets = tickets.map((ticket) => ({
      ...ticket,
      events: eventsMap.get(ticket.event_id) || null,
      ticket_tiers: tiersMap.get(ticket.tier_id) || null,
      orders: ticket.order_id ? ordersMap.get(ticket.order_id) || null : null,
    }));

    return cors(new Response(JSON.stringify({ tickets: enrichedTickets }), { status: 200 }));
  } catch (e) {
    console.error("get-user-tickets fatal:", e);
    return cors(new Response(JSON.stringify({ error: e?.message ?? "unknown_error" }), { status: 500 }));
  }
});
