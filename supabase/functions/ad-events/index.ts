import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://app.liventix.com",
  "https://staging.liventix.com",
  "http://localhost:5173",
];

// Inline CORS helper (no external dependencies)
interface WithCORSOpts {
  allowOrigins?: string[];
}

function withCORS(
  handler: (req: Request) => Promise<Response>,
  opts: WithCORSOpts = {},
) {
  return async (req: Request) => {
    const origin = req.headers.get("Origin") || "";

    // Determine which origin to allow
    let allowOrigin = "*";
    if (opts.allowOrigins?.length) {
      const isAllowed = opts.allowOrigins.some(allowed => {
        if (allowed === origin) return true;
        // Support wildcard patterns like *.liventix.com
        if (allowed.includes("*")) {
          const pattern = allowed.replace(/\./g, "\\.").replace(/\*/g, ".*");
          return new RegExp(`^${pattern}$`).test(origin);
        }
        return false;
      });

      allowOrigin = isAllowed ? origin : "*";
    }

    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowOrigin,
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const res = await handler(req);
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.set("Vary", "Origin");
    return new Response(res.body, { status: res.status, headers });
  };
}

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
  
  // Budget/wallet issues (client should not retry)
  if (lower.includes("budget") || lower.includes("insufficient") || lower.includes("frozen") || lower.includes("wallet")) {
    return 409;
  }
  
  // Campaign/placement not found (client should not retry)
  if (lower.includes("campaign not") || lower.includes("placement")) {
    return 404;
  }
  
  // Note: Frequency caps and duplicates are now handled gracefully by the RPC
  // (they return chargedCredits=0 instead of throwing), so we don't 429 them
  
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

      const requestId = body?.requestId ?? crypto.randomUUID();
      const pricingModel = body.pricingModel ?? meta.pricing_model ?? meta.pricingModel ?? 'cpm';
      const rateCredits = body.rateCredits ?? meta.rate_credits ?? meta.rateCredits ?? 0;
      const bidCredits = body.bidCredits ?? meta.bid_credits ?? meta.bidCredits ?? rateCredits; // fallback to rateCredits
      const pctVisible = body.pctVisible ?? meta.pct_visible ?? meta.pctVisible ?? null;
      const dwellMs = body.dwellMs ?? meta.dwell_ms ?? meta.dwellMs ?? null;
      const viewable = body.viewable ?? meta.viewable ?? false;
      const freqCap = body.freqCap ?? meta.freq_cap ?? meta.freqCap ?? null;

      console.log("[ad-events] Calling log_impression_and_charge with:", {
        p_campaign_id: meta.campaignId,
        p_creative_id: meta.creativeId,
        p_event_id: meta.eventId,
        p_placement: meta.placement,
        p_session_id: sessionId,
        p_pricing_model: pricingModel,
        p_rate_credits: rateCredits,
        p_bid_credits: bidCredits,
      });

      const { data, error } = await admin.rpc("log_impression_and_charge", {
        p_campaign_id: meta.campaignId,
        p_creative_id: meta.creativeId ?? null,
        p_user_id: viewerId,
        p_session_id: sessionId,
        p_event_id: meta.eventId ?? null,
        p_placement: meta.placement,
        p_request_id: requestId,
        p_pricing_model: pricingModel,
        p_rate_credits: rateCredits,
        p_bid_credits: bidCredits,
        p_viewable: viewable,
        p_pct_visible: pctVisible,
        p_dwell_ms: dwellMs,
        p_freq_cap: freqCap,
      });

      if (error) {
        console.error("[ad-events] log_impression_and_charge error:", error);
        const status = classifyError(error.message);
        return json(status, { error: error.message ?? "Failed to log impression" });
      }

      console.log("[ad-events] Impression logged successfully:", { impressionId: data?.[0]?.impression_id });

      const row = Array.isArray(data) && data.length ? data[0] : null;
      return json(200, {
        success: true,
        impressionId: row?.impression_id ?? null,
        chargedCredits: row?.charged_credits ?? null,
      });
    }

    if (type === "click") {
      if (!meta?.campaignId) {
        return json(400, { error: "campaignId is required" });
      }

      const requestId = body?.requestId ?? crypto.randomUUID();
      const pricingModel = meta.pricing_model ?? meta.pricingModel ?? 'cpc';
      const bidCredits = meta.bid_credits ?? meta.bidCredits ?? 0;

      console.log("[ad-events] Calling log_click_and_charge with:", {
        p_campaign_id: meta.campaignId,
        p_impression_id: meta.impressionId,
        p_request_id: requestId,
        p_session_id: sessionId,
      });

      const { data, error } = await admin.rpc("log_click_and_charge", {
        p_impression_id: meta.impressionId ?? null,
        p_campaign_id: meta.campaignId,
        p_creative_id: meta.creativeId ?? null,
        p_user_id: viewerId,
        p_session_id: sessionId,
        p_pricing_model: pricingModel,
        p_bid_credits: bidCredits,
        p_request_id: requestId,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      });

      if (error) {
        console.error("[ad-events] log_click_and_charge error:", error);
        const status = classifyError(error.message);
        return json(status, { error: error.message ?? "Failed to log click" });
      }

      console.log("[ad-events] Click logged successfully:", { clickId: data?.[0]?.click_id });

      const row = Array.isArray(data) && data.length ? data[0] : null;
      return json(200, {
        success: true,
        clickId: row?.click_id ?? null,
        chargedCredits: row?.charged_credits ?? 0,
      });
    }

    return json(400, { error: "Invalid event type" });
  } catch (err) {
    console.error("[ad-events] error", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return json(500, { error: message });
  }
}, { allowOrigins: ALLOWED_ORIGINS });

Deno.serve(handler);
