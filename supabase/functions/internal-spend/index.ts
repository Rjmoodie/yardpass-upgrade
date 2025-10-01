import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify service token (simple bearer token check)
    const authHeader = req.headers.get("Authorization");
    const serviceToken = Deno.env.get("INTERNAL_SERVICE_TOKEN");

    if (!authHeader || !serviceToken || authHeader !== `Bearer ${serviceToken}`) {
      throw new Error("Unauthorized - invalid service token");
    }

    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      throw new Error("Idempotency-Key header required");
    }

    const body = await req.json();
    const {
      campaign_id,
      wallet_id,
      org_wallet_id,
      metric_type,
      quantity,
      rate_model,
      rate_usd_cents,
      occurred_at,
    } = body;

    // Validate exactly one wallet type
    if ((!wallet_id && !org_wallet_id) || (wallet_id && org_wallet_id)) {
      throw new Error("Exactly one of wallet_id or org_wallet_id must be provided");
    }

    const isOrgWallet = !!org_wallet_id;
    const activeWalletId = isOrgWallet ? org_wallet_id : wallet_id;

    console.log(
      `[internal-spend] Campaign ${campaign_id}, ${quantity} ${metric_type}s @ ${rate_model} (${isOrgWallet ? 'org' : 'user'} wallet)`
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check idempotency (check both tables)
    const txTable = isOrgWallet ? "org_wallet_transactions" : "wallet_transactions";
    const { data: existing } = await supabase
      .from(txTable)
      .select("*")
      .eq("metadata->idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      console.log(`[internal-spend] Idempotent request - already processed`);
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Calculate credits charged based on rate model
    let creditsCharged = 0;
    if (rate_model === "cpm") {
      // CPM: rate is per 1000 impressions
      creditsCharged = Math.ceil((quantity / 1000) * rate_usd_cents);
    } else if (rate_model === "cpc") {
      // CPC: rate is per click
      creditsCharged = Math.ceil(quantity * rate_usd_cents);
    }

    // Lock wallet and check balance
    const walletTable = isOrgWallet ? "org_wallets" : "wallets";
    const { data: wallet, error: lockError } = await supabase
      .from(walletTable)
      .select("balance_credits, status")
      .eq("id", activeWalletId)
      .single();

    if (lockError) throw lockError;

    if (wallet.status === "frozen") {
      throw new Error("Wallet is frozen");
    }

    if (wallet.balance_credits < creditsCharged) {
      console.log(
        `[internal-spend] Insufficient funds: ${wallet.balance_credits} < ${creditsCharged}`
      );
      throw new Error("Insufficient funds");
    }

    // Create wallet transaction (deduction)
    let transaction: any;
    if (isOrgWallet) {
      const { data: tx, error: txError } = await supabase
        .from("org_wallet_transactions")
        .insert({
          wallet_id: activeWalletId,
          credits_delta: -creditsCharged,
          transaction_type: "spend",
          description: `${metric_type} spend (${rate_model.toUpperCase()})`,
          reference_type: "campaign",
          reference_id: campaign_id,
          metadata: { idempotency_key: idempotencyKey }
        })
        .select()
        .single();
      if (txError) throw txError;
      transaction = tx;
    } else {
      const { data: tx, error: txError } = await supabase
        .from("wallet_transactions")
        .insert({
          wallet_id: activeWalletId,
          type: "spend",
          credits_delta: -creditsCharged,
          reference_type: "campaign",
          reference_id: campaign_id,
          memo: `${metric_type} spend (${rate_model.toUpperCase()})`,
          idempotency_key,
        })
        .select()
        .single();
      if (txError) throw txError;
      transaction = tx;
    }

    // Update wallet balance
    const { error: balError } = await supabase
      .from(walletTable)
      .update({
        balance_credits: wallet.balance_credits - creditsCharged,
      })
      .eq("id", activeWalletId);

    if (balError) {
      // Rollback transaction if balance update fails
      await supabase.from(txTable).delete().eq("id", transaction.id);
      throw balError;
    }

    // Record in ad_spend_ledger
    const ledgerRow: any = {
      campaign_id,
      metric_type,
      quantity,
      rate_model,
      rate_usd_cents,
      credits_charged: creditsCharged,
      occurred_at: occurred_at || new Date().toISOString(),
      wallet_transaction_id: transaction.id,
    };

    if (isOrgWallet) {
      ledgerRow.org_wallet_id = activeWalletId;
    } else {
      ledgerRow.wallet_id = activeWalletId;
    }

    const { error: ledgerError } = await supabase
      .from("ad_spend_ledger")
      .insert(ledgerRow);

    if (ledgerError) {
      console.error(`[internal-spend] Ledger insert failed:`, ledgerError);
      // Don't rollback - transaction already committed
    }

    const newBalance = wallet.balance_credits - creditsCharged;
    console.log(
      `[internal-spend] Charged ${creditsCharged} credits, new balance: ${newBalance}`
    );

    // Check if auto-reload needed
    const { data: walletSettings } = await supabase
      .from(walletTable)
      .select("auto_reload_enabled, low_balance_threshold, auto_reload_topup_credits")
      .eq("id", activeWalletId)
      .single();

    if (
      walletSettings?.auto_reload_enabled &&
      newBalance < walletSettings.low_balance_threshold
    ) {
      console.log(`[internal-spend] Triggering auto-reload for ${isOrgWallet ? 'org' : 'user'} wallet ${activeWalletId}`);
      // TODO: Trigger auto-reload via separate function
    }

    return new Response(
      JSON.stringify({ remaining_balance: newBalance }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[internal-spend] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message.includes("Unauthorized") ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});