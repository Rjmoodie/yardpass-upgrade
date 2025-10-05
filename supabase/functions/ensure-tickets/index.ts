import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const ok  = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "content-type": "application/json" }});
const err = (m: string, s = 400) => ok({ error: m }, s);

function safeJson(req: Request) {
  return req.json().catch(() => ({}));
}

function code(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = req.method === "GET" ? { order_id: url.searchParams.get("order_id") } : await safeJson(req);
    const order_id = String(body.order_id || "").trim();
    if (!order_id) return err("Missing order_id", 422);

    console.log("[ENSURE-TICKETS] start", { order_id });

    // 1) Order must exist
    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("id, status, user_id, event_id, tickets_issued_count")
      .eq("id", order_id)
      .single();
    if (oErr || !order) return err("Order not found", 404);

    // 2) Idempotency fast-path: any existing tickets?
    const { count: existingCount } = await admin
      .from("tickets")
      .select("*", { head: true, count: "exact" })
      .eq("order_id", order_id);
    if ((existingCount ?? 0) > 0) {
      console.log("[ENSURE-TICKETS] already issued", { existingCount });
      return ok({ issued: 0, already_issued: existingCount, status: "ok" });
    }

    // 3) Must be paid (or equivalent)
    const paidStates = new Set(["paid","succeeded","complete","completed"]);
    if (!paidStates.has(String(order.status).toLowerCase())) {
      return err(`Order not paid (status=${order.status})`, 409);
    }

    // 4) Load items (no embed; avoid relationship ambiguity)
    const { data: items, error: itErr } = await admin
      .from("order_items")
      .select("id, ticket_tier_id, tier_id, quantity")
      .eq("order_id", order_id);
    if (itErr) return err(`Load items failed: ${itErr.message}`, 500);
    if (!items?.length) return err("No order items found", 422);

    // normalize tier id field name
    const normalized = items.map((i: any) => ({
      id: i.id,
      tier_id: i.tier_id ?? i.ticket_tier_id,
      quantity: Math.max(0, Number(i.quantity) || 0),
    })).filter(i => i.tier_id && i.quantity > 0);
    if (!normalized.length) return err("Nothing to issue (all quantities = 0)", 422);

    // 5) Fetch tiers once, build map
    const tierIds = Array.from(new Set(normalized.map(i => i.tier_id)));
    const { data: tiers, error: tErr } = await admin
      .from("ticket_tiers")
      .select("id, event_id, name, total_quantity, sold_quantity")
      .in("id", tierIds.length ? tierIds : ["00000000-0000-0000-0000-000000000000"]);
    if (tErr) return err(`Load tiers failed: ${tErr.message}`, 500);

    const tierMap = new Map((tiers || []).map((t: any) => [t.id, t]));
    for (const it of normalized) {
      if (!tierMap.get(it.tier_id)) {
        return err(`Missing tier ${it.tier_id} for order_item ${it.id}`, 422);
      }
    }

    // 6) Optional capacity check (only if total/sold exist)
    for (const it of normalized) {
      const tt = tierMap.get(it.tier_id)!;
      const hasInventory = Number.isFinite(tt?.total_quantity);
      if (hasInventory) {
        const sold = Number(tt.sold_quantity ?? 0);
        const total = Number(tt.total_quantity ?? 0);
        const available = Math.max(0, total - sold);
        if (it.quantity > available) {
          return err(`Tier ${it.tier_id} over capacity: request=${it.quantity} available=${available}`, 409);
        }
      }
    }

    // 7) Build ticket rows with serial_no (1..quantity) for deterministic upsert
    const rows: any[] = [];
    for (const it of normalized) {
      const tt = tierMap.get(it.tier_id)!;
      for (let n = 1; n <= it.quantity; n++) {
        rows.push({
          order_id,
          event_id: tt.event_id,
          tier_id: it.tier_id,
          serial_no: n,                // <- critical for onConflict idempotency
          qr_code: code(8),
          status: "issued",
          owner_user_id: order.user_id ?? null,
          created_at: new Date().toISOString(),
        });
      }
    }

    // 8) Upsert (idempotent). If another worker raced us, nothing bad happens.
    const { error: upErr, count: upCount } = await admin
      .from("tickets")
      .upsert(rows, { onConflict: "order_id,tier_id,serial_no", ignoreDuplicates: false, count: "exact" });
    if (upErr) {
      // If your index isn't created yet you might get a duplicate here; return 500 so caller retries later.
      return err(`Upsert tickets failed: ${upErr.message}`, 500);
    }

    // 9) Mark order as complete (don't downgrade status if it's already complete)
    const nextStatus = paidStates.has(String(order.status).toLowerCase()) ? "complete" : order.status;
    await admin
      .from("orders")
      .update({ status: nextStatus, tickets_issued_count: upCount ?? 0, paid_at: new Date().toISOString() })
      .eq("id", order_id);

    const { count: finalCount } = await admin
      .from("tickets")
      .select("*", { head: true, count: "exact" })
      .eq("order_id", order_id);

    console.log("[ENSURE-TICKETS] success", { order_id, issued: finalCount ?? 0 });
    return ok({ issued: finalCount ?? 0, status: "ok" });
  } catch (e: any) {
    console.error("[ENSURE-TICKETS] error", { message: e?.message, stack: e?.stack });
    return err(`ensure-tickets error: ${e?.message || String(e)}`, 500);
  }
});
