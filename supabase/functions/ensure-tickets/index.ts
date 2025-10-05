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

const paidStates = new Set(["paid","succeeded","complete","completed"]);

const ok  = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "content-type": "application/json", "cache-control": "no-store" }});
const err = (m: string, s = 400) => ok({ error: m }, s);

function safeJson(req: Request) {
  return req.json().catch(() => ({}));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = req.method === "GET" ? {
      order_id: url.searchParams.get("order_id"),
      session_id: url.searchParams.get("session_id"),
    } : await safeJson(req);

    const order_id_in = String(body.order_id || "").trim();
    const session_id = String(body.session_id || "").trim();

    // 1) Resolve order either by id or by checkout_session_id
    let order: any | null = null;

    if (order_id_in) {
      const { data, error } = await admin
        .from("orders")
        .select("id, status, user_id, event_id, tickets_issued_count, checkout_session_id")
        .eq("id", order_id_in).maybeSingle();
      if (error) return err(`Order lookup failed: ${error.message}`, 500);
      order = data;
    } else if (session_id) {
      const { data, error } = await admin
        .from("orders")
        .select("id, status, user_id, event_id, tickets_issued_count, checkout_session_id")
        .eq("checkout_session_id", session_id).maybeSingle();
      if (error) return err(`Order lookup by session failed: ${error.message}`, 500);
      order = data;
    } else {
      return err("Provide order_id or session_id", 422);
    }

    if (!order) return err("Order not found", 404);
    const order_id = order.id as string;

    console.log("[ENSURE-TICKETS] start", { order_id, session_id });

    // 2) Fast-path if tickets already exist
    const { count: existingCount, error: cErr } = await admin
      .from("tickets")
      .select("*", { head: true, count: "exact" })
      .eq("order_id", order_id);
    if (cErr) return err(`Count failed: ${cErr.message}`, 500);
    if ((existingCount ?? 0) > 0) {
      console.log("[ENSURE-TICKETS] already issued", { existingCount });
      return ok({ status: "already_issued", issued: existingCount });
    }

    // 3) If not paid yet, don't throw - return 200 with pending state
    const isPaid = paidStates.has(String(order.status).toLowerCase());
    if (!isPaid) {
      console.log("[ENSURE-TICKETS] order not paid yet", { status: order.status });
      return ok({ status: "pending", order_status: order.status });
    }

    // 4) Claim advisory lock to serialize concurrent issuers
    const { data: locked, error: lockErr } = await admin.rpc('claim_order_ticketing', { p_order_id: order_id });
    if (lockErr) return err(`Lock failed: ${lockErr.message}`, 500);
    if (!locked) {
      console.log("[ENSURE-TICKETS] lock contention, another process is issuing");
      return ok({ status: "busy" });
    }

    // 5) Load items
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

    // 6) Fetch tiers once, build map (only need event_id and name for ticket creation)
    const tierIds = Array.from(new Set(normalized.map(i => i.tier_id)));
    const { data: tiers, error: tErr } = await admin
      .from("ticket_tiers")
      .select("id, event_id, name")
      .in("id", tierIds.length ? tierIds : ["00000000-0000-0000-0000-000000000000"]);
    if (tErr) return err(`Load tiers failed: ${tErr.message}`, 500);

    const tierMap = new Map((tiers || []).map((t: any) => [t.id, t]));
    for (const it of normalized) {
      if (!tierMap.get(it.tier_id)) {
        return err(`Missing tier ${it.tier_id} for order_item ${it.id}`, 422);
      }
    }

    // 7) Build ticket rows - DB enforces capacity via BEFORE INSERT trigger
    // DB assigns serial_no via trigger and qr_code via DEFAULT
    const rows: any[] = [];
    for (const it of normalized) {
      const tt = tierMap.get(it.tier_id)!;
      for (let n = 1; n <= it.quantity; n++) {
        rows.push({
          order_id,
          event_id: tt.event_id,
          tier_id: it.tier_id,
          // serial_no: auto-assigned by trg_assign_serial_no trigger
          // qr_code: auto-generated by gen_qr_code() DEFAULT
          status: "issued",
          owner_user_id: order.user_id ?? null,
          created_at: new Date().toISOString(),
        });
      }
    }

    // 6) Insert tickets (DB assigns serial_no + qr_code; triggers handle capacity & counts)
    const { error: insErr } = await admin
      .from("tickets")
      .insert(rows);
    if (insErr) {
      console.error("[ENSURE-TICKETS] insert failed", { error: insErr.message, code: insErr.code });
      // Capacity errors are graceful - trigger raises exception
      if (insErr.message?.includes('capacity') || insErr.message?.includes('Tier')) {
        return ok({ status: "capacity_error", message: insErr.message });
      }
      return err(`Insert tickets failed: ${insErr.message}`, 500);
    }

    // 7) Mark order complete and return final count
    const nextStatus = "complete";
    await admin
      .from("orders")
      .update({ status: nextStatus, paid_at: new Date().toISOString() })
      .eq("id", order_id);

    const { count: finalCount } = await admin
      .from("tickets")
      .select("*", { head: true, count: "exact" })
      .eq("order_id", order_id);

    console.log("[ENSURE-TICKETS] success", { order_id, issued: finalCount ?? 0 });
    return ok({ status: "issued", issued: finalCount ?? 0 });
  } catch (e: any) {
    console.error("[ENSURE-TICKETS] error", { message: e?.message, stack: e?.stack });
    return err(`ensure-tickets error: ${e?.message || String(e)}`, 500);
  }
});
