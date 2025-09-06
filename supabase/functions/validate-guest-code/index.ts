import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateCodeRequest {
  eventId: string;
  code: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, code }: ValidateCodeRequest = await req.json();

    if (!eventId || !code) {
      return new Response(
        JSON.stringify({ error: "Missing eventId or code" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find and validate the guest code
    const { data: guestCode, error: codeError } = await supabaseClient
      .from('guest_codes')
      .select(`
        id,
        code,
        tier_id,
        max_uses,
        used_count,
        expires_at,
        ticket_tiers (
          id,
          name,
          price_cents
        )
      `)
      .eq('event_id', eventId)
      .eq('code', code.toUpperCase())
      .maybeSingle();

    if (codeError) {
      console.error('Error fetching guest code:', codeError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    if (!guestCode) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Invalid guest code" 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check if code is expired
    if (guestCode.expires_at && new Date(guestCode.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Guest code has expired" 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check if code has remaining uses
    if (guestCode.used_count >= guestCode.max_uses) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: "Guest code has been used up" 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Return valid code information
    return new Response(
      JSON.stringify({
        valid: true,
        guestCode: {
          id: guestCode.id,
          code: guestCode.code,
          tier_id: guestCode.tier_id,
          tier_name: guestCode.ticket_tiers?.name,
          tier_price_cents: guestCode.ticket_tiers?.price_cents || 0
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error('Error in validate-guest-code function:', error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});