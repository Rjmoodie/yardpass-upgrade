import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: "ok" | "error";
    stripe?: "ok" | "error" | "skipped";
    mux?: "ok" | "error" | "skipped";
    posthog?: "ok" | "error" | "skipped";
  };
  details?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const healthStatus: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: "error",
    },
  };

  try {
    // Check database connectivity
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      healthStatus.status = "unhealthy";
      healthStatus.details = { error: "Missing Supabase configuration" };
      return new Response(JSON.stringify(healthStatus), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Simple database query to verify connectivity
    const { error: dbError } = await supabase.from("user_profiles").select("user_id").limit(1);

    if (dbError) {
      healthStatus.checks.database = "error";
      healthStatus.status = "degraded";
      healthStatus.details = { database_error: dbError.message };
    } else {
      healthStatus.checks.database = "ok";
    }

    // Optional: Check Stripe connectivity
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeSecret) {
      try {
        // Simple check - just verify key format (starts with sk_)
        if (stripeSecret.startsWith("sk_")) {
          healthStatus.checks.stripe = "ok";
        } else {
          healthStatus.checks.stripe = "error";
          healthStatus.status = "degraded";
        }
      } catch {
        healthStatus.checks.stripe = "error";
        healthStatus.status = "degraded";
      }
    } else {
      healthStatus.checks.stripe = "skipped";
    }

    // Optional: Check Mux (if configured)
    const muxTokenId = Deno.env.get("MUX_TOKEN_ID");
    if (muxTokenId) {
      healthStatus.checks.mux = "ok"; // Assume ok if env var exists
    } else {
      healthStatus.checks.mux = "skipped";
    }

    // Optional: Check PostHog (if configured)
    const posthogKey = Deno.env.get("POSTHOG_API_KEY");
    if (posthogKey) {
      healthStatus.checks.posthog = "ok"; // Assume ok if env var exists
    } else {
      healthStatus.checks.posthog = "skipped";
    }

    // Determine overall status
    if (healthStatus.checks.database === "error") {
      healthStatus.status = "unhealthy";
    } else if (
      Object.values(healthStatus.checks).some((check) => check === "error")
    ) {
      healthStatus.status = "degraded";
    }

    const statusCode = healthStatus.status === "unhealthy" ? 503 : healthStatus.status === "degraded" ? 200 : 200;

    return new Response(JSON.stringify(healthStatus), {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    healthStatus.status = "unhealthy";
    healthStatus.details = {
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return new Response(JSON.stringify(healthStatus), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

