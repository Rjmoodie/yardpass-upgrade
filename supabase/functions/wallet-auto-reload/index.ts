import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { enabled, threshold, topup_credits, payment_method_id } = body;

    console.log(`[wallet-auto-reload] Updating settings for user ${user.id}`);

    // Get wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!wallet) throw new Error("Wallet not found");

    // Update auto-reload settings
    const { error: updateError } = await supabase
      .from("wallets")
      .update({
        auto_reload_enabled: enabled,
        low_balance_threshold: threshold || wallet.low_balance_threshold,
        auto_reload_topup_credits: topup_credits || wallet.auto_reload_topup_credits,
        default_payment_method_id: payment_method_id || wallet.default_payment_method_id,
      })
      .eq("id", wallet.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[wallet-auto-reload] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});