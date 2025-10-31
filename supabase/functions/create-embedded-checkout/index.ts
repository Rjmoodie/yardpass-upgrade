import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment configuration");
    }

    const { checkoutSessionId, eventId } = await req.json();
    
    if (!checkoutSessionId) {
      throw new Error("Checkout session ID is required");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    // Fetch the checkout session from database
    const { data: session, error: sessionError } = await supabase
      .from('checkout_sessions')
      .select('stripe_session_id, status, expires_at')
      .eq('id', checkoutSessionId)
      .single();

    if (sessionError || !session) {
      throw new Error('Checkout session not found');
    }

    if (session.status !== 'pending') {
      throw new Error('Checkout session is no longer active');
    }

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Checkout session has expired',
          error_code: 'SESSION_EXPIRED'
        }),
        {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!session.stripe_session_id) {
      throw new Error('No Stripe session ID found');
    }

    // Retrieve the Stripe session to get client secret
    const stripeSession = await stripe.checkout.sessions.retrieve(session.stripe_session_id);
    
    if (!stripeSession.client_secret) {
      throw new Error('No client secret available for this session');
    }

    return new Response(
      JSON.stringify({
        clientSecret: stripeSession.client_secret,
        sessionId: stripeSession.id,
        expiresAt: session.expires_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[create-embedded-checkout] error", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error)?.message ?? "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

