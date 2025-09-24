import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧹 Ticket expiry daemon started');

    // Initialize Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get all expired holds
    const { data: expiredHolds, error: expiredError } = await supabaseService
      .from('ticket_holds')
      .select('id, tier_id, quantity')
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());

    if (expiredError) {
      console.error('❌ Failed to fetch expired holds:', expiredError);
      throw expiredError;
    }

    if (!expiredHolds || expiredHolds.length === 0) {
      console.log('✅ No expired holds found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expired holds found',
          processed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 Found ${expiredHolds.length} expired holds`);

    // Group by tier_id to batch updates
    const tierUpdates = new Map<string, number>();
    for (const hold of expiredHolds) {
      const currentQuantity = tierUpdates.get(hold.tier_id) || 0;
      tierUpdates.set(hold.tier_id, currentQuantity + hold.quantity);
    }

    // Mark holds as expired
    const { error: markExpiredError } = await supabaseService
      .from('ticket_holds')
      .update({ status: 'expired' })
      .in('id', expiredHolds.map(h => h.id));

    if (markExpiredError) {
      console.error('❌ Failed to mark holds as expired:', markExpiredError);
      throw markExpiredError;
    }

    // Release reserved quantities back to available
    const releasePromises = Array.from(tierUpdates.entries()).map(async ([tierId, quantity]) => {
      const { error } = await supabaseService
        .rpc('adjust_reserved_quantity', {
          p_tier_id: tierId,
          p_quantity_delta: -quantity // Negative to decrease reserved
        });
      
      if (error) {
        console.error(`❌ Failed to release quantity for tier ${tierId}:`, error);
        throw error;
      }
      
      console.log(`✅ Released ${quantity} tickets for tier ${tierId}`);
    });

    await Promise.all(releasePromises);

    // Log operation to inventory_operations table
    const { error: logError } = await supabaseService
      .from('inventory_operations')
      .insert({
        operation_type: 'bulk_release',
        user_id: null, // System operation
        metadata: {
          expired_holds_count: expiredHolds.length,
          tier_updates: Object.fromEntries(tierUpdates),
          processed_at: new Date().toISOString()
        }
      });

    if (logError) {
      console.warn('⚠️ Failed to log operation:', logError);
    }

    console.log(`✅ Successfully processed ${expiredHolds.length} expired holds`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: expiredHolds.length,
        tier_updates: Object.fromEntries(tierUpdates),
        message: `Processed ${expiredHolds.length} expired holds`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('❌ Ticket expiry daemon error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as any).message,
        error_code: 'EXPIRY_DAEMON_FAILED'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});