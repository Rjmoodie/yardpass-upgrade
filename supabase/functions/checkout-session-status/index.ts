import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  defaultExpressMethods,
  hashEmail,
  normalizeEmail,
  updateCheckoutSession,
} from "../_shared/checkout-session.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration");
    }

    const body = await req.json().catch(() => ({}));
    const checkoutSessionId = String(body.checkoutSessionId || body.id || "").trim();
    const providedEmail = typeof body.email === "string" ? body.email : undefined;

    if (!checkoutSessionId) {
      return ok({ error: "checkoutSessionId is required" }, 400);
    }

    const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

    let requesterUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer", "").trim();
      if (token) {
        const { data: userData } = await supabaseAnon.auth.getUser(token);
        requesterUserId = userData?.user?.id ?? null;
      }
    }

    const { data: sessionRecord, error: sessionError } = await supabaseService
      .from("checkout_sessions")
      .select(
        `id, status, user_id, event_id, order_id, expires_at, pricing_snapshot, contact_snapshot, verification_state, express_methods`
      )
      .eq("id", checkoutSessionId)
      .maybeSingle();

    if (sessionError) {
      console.error("[checkout-session-status] session lookup error", sessionError);
      return ok({ error: "Unable to load checkout session" }, 500);
    }

    if (!sessionRecord) {
      return ok({ error: "Checkout session not found" }, 404);
    }

    let authorized = false;
    if (sessionRecord.user_id && requesterUserId && sessionRecord.user_id === requesterUserId) {
      authorized = true;
    }

    const normalizedEmail = normalizeEmail(providedEmail ?? null);
    const storedHash = sessionRecord.contact_snapshot?.email_hash ?? null;
    if (!authorized && normalizedEmail && storedHash) {
      const hashed = await hashEmail(normalizedEmail);
      if (hashed === storedHash) {
        authorized = true;
      }
    }

    if (!authorized) {
      return ok({ error: "Unauthorized" }, 403);
    }

    const nowMs = Date.now();
    let status = sessionRecord.status ?? "pending";
    let expiresAtMs = sessionRecord.expires_at ? Date.parse(sessionRecord.expires_at) : null;

    if (status === "pending" && expiresAtMs && expiresAtMs <= nowMs) {
      status = "expired";
      await updateCheckoutSession(supabaseService, checkoutSessionId, { status: "expired" });
    }

    let extended = false;
    if (status === "pending" && expiresAtMs && expiresAtMs > nowMs && expiresAtMs - nowMs < 4 * 60 * 1000) {
      const { data: extension, error: extensionError } = await supabaseService
        .rpc("extend_ticket_holds", { p_session_id: checkoutSessionId, p_extend_minutes: 10 });

      if (extensionError) {
        console.warn("[checkout-session-status] failed to extend holds", extensionError);
      } else if (extension?.success) {
        extended = true;
        expiresAtMs = extension.expires_at ? Date.parse(extension.expires_at) : expiresAtMs;
        await updateCheckoutSession(supabaseService, checkoutSessionId, { expiresAt: expiresAtMs ? new Date(expiresAtMs) : null });
      }
    }

    const pricingSnapshot = sessionRecord.pricing_snapshot ?? {};
    const expressMethods = sessionRecord.express_methods ?? defaultExpressMethods;
    const verification = sessionRecord.verification_state ?? {
      email_verified: Boolean(sessionRecord.user_id),
      risk_score: 0,
    };

    const responseBody = {
      status,
      expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : sessionRecord.expires_at ?? null,
      pricing: {
        subtotalCents: pricingSnapshot.subtotal_cents ?? 0,
        feesCents: pricingSnapshot.fees_cents ?? 0,
        totalCents: pricingSnapshot.total_cents ?? 0,
        currency: pricingSnapshot.currency ?? "USD",
      },
      canExtendHold:
        status === "pending" && Boolean(expiresAtMs) && !extended && expiresAtMs - nowMs < 5 * 60 * 1000,
      expressMethods: {
        applePay: Boolean(expressMethods.applePay ?? expressMethods.apple_pay),
        googlePay: Boolean(expressMethods.googlePay ?? expressMethods.google_pay),
        link: Boolean(expressMethods.link),
      },
      verification: {
        emailVerified: Boolean(verification.email_verified),
        riskScore: Number(verification.risk_score ?? 0),
      },
    };

    console.log("[checkout-session-status] heartbeat", {
      checkoutSessionId,
      status: responseBody.status,
      expiresAt: responseBody.expiresAt,
      canExtendHold: responseBody.canExtendHold,
    });

    return ok(responseBody);
  } catch (error) {
    console.error("[checkout-session-status] unexpected error", error);
    return ok({ error: (error as Error)?.message ?? "Unexpected error" }, 500);
  }
});
