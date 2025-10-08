import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withCORS } from "../_shared/cors.ts";

const ALLOWED_ORIGINS = [
  "https://app.yardpass.com",
  "https://staging.yardpass.com",
  "http://localhost:5173",
];

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error("Missing required Supabase environment variables");
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeSessionId(input) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed.length ? trimmed.slice(0, 128) : null;
}

function firstIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const part = forwarded.split(",")[0]?.trim();
    if (part) return part;
  }
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

function classifyError(message) {
  if (!message) return 500;
  const lower = message.toLowerCase();
  if (lower.includes("budget") || lower.includes("insufficient") || lower.includes("frozen") || lower.includes("wallet")) {
    return 409;
  }
  if (lower.includes("frequency") || lower.includes("session")) {
    return 429;
  }
  if (lower.includes("campaign not") || lower.includes("placement")) {
    return 404;
  }
  return 500;
}

const handler = withCORS(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const type = body?.type;
    const meta = body?.meta ?? {};
    const sessionId = normalizeSessionId(body?.sessionId);
    const explicitAgent = typeof body?.userAgent === "string" && body.userAgent.trim().length ? body.userAgent.trim() : null;
    const userAgent = explicitAgent ?? req.headers.get("user-agent") ?? null;
    const ipAddress = firstIp(req);
    const timestampIso = typeof body?.now === "string" && body.now ? body.now : new Date().toISOString();

    let viewerId = null;
    if (authHeader) {
      const { data, error } = await client.auth.getUser();
      if (!error && data?.user) {
        viewerId = data.user.id;
      }
    }

    if (type === "impression") {
      if (!meta?.campaignId || !meta?.placement) {
        return json(400, { error: "campaignId and placement are required" });
      }

      const { data, error } = await admin.rpc("log_impression_and_charge", {
        p_campaign_id: meta.campaignId,
        p_creative_id: meta.creativeId ?? null,
        p_event_id: meta.eventId ?? null,
        p_post_id: meta.postId ?? null,
        p_user_id: viewerId,
        p_session_id: sessionId,
        p_placement: meta.placement,
        p_user_agent: userAgent,
        p_ip_address: ipAddress,
        p_now: timestampIso,
      });

      if (error) {
        const status = classifyError(error.message);
        return json(status, { error: error.message ?? "Failed to log impression" });
      }

      const row = Array.isArray(data) && data.length ? data[0] : null;
      return json(200, {
        success: true,
        impressionId: row?.impression_id ?? null,
        chargedCredits: row?.charged_credits ?? null,
        remainingBudget: row?.remaining_budget ?? null,
      });
    }

    if (type === "click") {
      if (!meta?.campaignId) {
        return json(400, { error: "campaignId is required" });
      }

      const { data, error } = await admin.rpc("log_ad_click_event", {
        p_campaign_id: meta.campaignId,
        p_creative_id: meta.creativeId ?? null,
        p_impression_id: meta.impressionId ?? null,
        p_user_id: viewerId,
        p_session_id: sessionId,
        p_now: timestampIso,
      });

      if (error) {
        const status = classifyError(error.message);
        return json(status, { error: error.message ?? "Failed to log click" });
      }

      return json(200, { success: true, clickId: data ?? null });
    }

    return json(400, { error: "Invalid event type" });
  } catch (err) {
    console.error("[ad-events] error", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return json(500, { error: message });
  }
}, { allowOrigins: ALLOWED_ORIGINS });

Deno.serve(handler);
