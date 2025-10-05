import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { 
  status: s, 
  headers: { ...corsHeaders, "content-type": "application/json" }
});

const err = (m: string, s = 400) => ok({ error: m }, s);

// Generate short human-readable ticket codes
function code(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();
    if (!order_id) return err("Missing order_id", 422);

    console.log(`[ENSURE-TICKETS] Processing order: ${order_id}`);

    // 1) Load order and check it's paid
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, status, user_id, event_id")
      .eq("id", order_id)
      .single();

    if (oErr || !order) {
      console.error(`[ENSURE-TICKETS] Order not found:`, oErr);
      return err("Order not found", 404);
    }

    if (!["paid", "succeeded", "complete"].includes(String(order.status))) {
      console.log(`[ENSURE-TICKETS] Order not paid (status=${order.status})`);
      return err(`Order not paid (status=${order.status})`, 409);
    }

    // 2) Idempotency: if tickets already exist, return them
    const { count: existingCount } = await admin
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("order_id", order_id);

    if ((existingCount ?? 0) > 0) {
      console.log(`[ENSURE-TICKETS] Tickets already exist: ${existingCount}`);
      return ok({ issued: 0, already_issued: existingCount, status: "ok" });
    }

    // 3) Load items WITHOUT embed to avoid "multiple relationships" error
    const { data: items, error: itErr } = await admin
      .from("order_items")
      .select("id, tier_id, quantity")
      .eq("order_id", order_id);

    if (itErr) {
      console.error(`[ENSURE-TICKETS] Load items failed:`, itErr);
      return err(`Load items failed: ${itErr.message}`, 500);
    }

    if (!items?.length) {
      console.error(`[ENSURE-TICKETS] No order items found`);
      return err("No order items found", 422);
    }

    // Load tiers separately
    const tierIds = Array.from(new Set(items.map(i => i.tier_id).filter(Boolean)));
    const { data: tiers, error: tErr } = await admin
      .from("ticket_tiers")
      .select("id, event_id, name")
      .in("id", tierIds.length ? tierIds : ["00000000-0000-0000-0000-000000000000"]);

    if (tErr) {
      console.error(`[ENSURE-TICKETS] Load tiers failed:`, tErr);
      return err(`Load tiers failed: ${tErr.message}`, 500);
    }

    const tierMap = new Map(tiers?.map(t => [t.id, t]) || []);

    // 4) Build ticket rows
    const rows: any[] = [];
    for (const it of items) {
      const q = Math.max(0, Number(it.quantity) || 0);
      if (!q) continue;
      const tt = tierMap.get(it.tier_id);
      if (!tt) {
        console.error(`[ENSURE-TICKETS] Missing tier ${it.tier_id} for order item ${it.id}`);
        return err(`Missing tier ${it.tier_id} for order item ${it.id}`, 422);
      }

      for (let n = 1; n <= q; n++) {
        rows.push({
          event_id: tt.event_id,
          order_id,
          tier_id: it.tier_id,
          serial_no: n,
          qr_code: code(8),
          status: "issued",
          owner_user_id: order.user_id ?? null,
          created_at: new Date().toISOString(),
        });
      }
    }

    if (!rows.length) {
      console.error(`[ENSURE-TICKETS] Nothing to issue (all quantities = 0)`);
      return err("Nothing to issue (all quantities = 0)", 422);
    }

    console.log(`[ENSURE-TICKETS] Creating ${rows.length} tickets`);

    // 5) Insert with idempotent handling via unique constraint
    const { error: insErr } = await admin
      .from("tickets")
      .insert(rows);

    // If a race happened, the unique index prevents dupes; treat as success
    if (insErr && !/duplicate key|unique|violates unique constraint/.test(insErr.message)) {
      console.error(`[ENSURE-TICKETS] Insert tickets failed:`, insErr);
      return err(`Insert tickets failed: ${insErr.message}`, 500);
    }

    // Optional: mark order as confirmed if not yet
    await admin
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", order_id);

    const { count: finalCount } = await admin
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("order_id", order_id);

    console.log(`[ENSURE-TICKETS] Success - issued: ${finalCount ?? 0} tickets`);

    return ok({ issued: finalCount ?? 0, status: "ok" });
  } catch (e: any) {
    console.error(`[ENSURE-TICKETS] Error:`, e);
    return err(`ensure-tickets error: ${e?.message || String(e)}`, 500);
  }
});
