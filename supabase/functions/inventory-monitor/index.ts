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
    console.log('📊 Inventory monitor started');

    // Initialize Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check for oversold tiers (critical alert)
    const { data: oversoldTiers, error: oversoldError } = await supabaseService
      .from('ticket_tiers')
      .select(`
        id, 
        name,
        event_id,
        total_quantity, 
        reserved_quantity, 
        issued_quantity,
        (total_quantity - reserved_quantity - issued_quantity) as available
      `)
      .lt('total_quantity', 'reserved_quantity + issued_quantity');

    if (oversoldError) {
      throw new Error(`Failed to check oversold tiers: ${oversoldError.message}`);
    }

    // Check for low inventory (warning alert)
    const { data: lowInventoryTiers, error: lowInventoryError } = await supabaseService
      .from('ticket_tiers')
      .select(`
        id, 
        name,
        event_id,
        total_quantity, 
        reserved_quantity, 
        issued_quantity,
        (total_quantity - reserved_quantity - issued_quantity) as available
      `)
      .gte('total_quantity', 'reserved_quantity + issued_quantity')
      .lte('total_quantity - reserved_quantity - issued_quantity', 5); // Less than 5 available

    if (lowInventoryError) {
      throw new Error(`Failed to check low inventory: ${lowInventoryError.message}`);
    }

    // Check for stale holds (over 30 minutes old)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: staleHolds, error: staleHoldsError } = await supabaseService
      .from('ticket_holds')
      .select('id, tier_id, quantity, expires_at, created_at')
      .eq('status', 'active')
      .lt('expires_at', thirtyMinutesAgo);

    if (staleHoldsError) {
      throw new Error(`Failed to check stale holds: ${staleHoldsError.message}`);
    }

    // Get overall inventory health metrics
    const { data: inventoryStats, error: statsError } = await supabaseService
      .from('ticket_tiers')
      .select(`
        count(*) as total_tiers,
        sum(total_quantity) as total_tickets,
        sum(reserved_quantity) as total_reserved,
        sum(issued_quantity) as total_issued
      `)
      .single();

    if (statsError) {
      throw new Error(`Failed to get inventory stats: ${statsError.message}`);
    }

    // Prepare alerts
    const alerts = [];
    
    if (oversoldTiers && oversoldTiers.length > 0) {
      alerts.push({
        level: 'CRITICAL',
        type: 'OVERSOLD_DETECTED',
        message: `${oversoldTiers.length} tier(s) are oversold!`,
        details: oversoldTiers
      });
    }

    if (lowInventoryTiers && lowInventoryTiers.length > 0) {
      alerts.push({
        level: 'WARNING',
        type: 'LOW_INVENTORY',
        message: `${lowInventoryTiers.length} tier(s) have low inventory`,
        details: lowInventoryTiers
      });
    }

    if (staleHolds && staleHolds.length > 0) {
      alerts.push({
        level: 'WARNING',
        type: 'STALE_HOLDS',
        message: `${staleHolds.length} hold(s) are overdue for expiry`,
        details: staleHolds
      });
    }

    // Log monitoring results
    const monitoringResult = {
      timestamp: new Date().toISOString(),
      alerts_count: alerts.length,
      inventory_health: {
        total_tiers: (inventoryStats as any)?.total_tiers || 0,
        total_tickets: (inventoryStats as any)?.total_tickets || 0,
        total_reserved: (inventoryStats as any)?.total_reserved || 0,
        total_issued: (inventoryStats as any)?.total_issued || 0,
        available: ((inventoryStats as any)?.total_tickets || 0) - ((inventoryStats as any)?.total_reserved || 0) - ((inventoryStats as any)?.total_issued || 0)
      },
      alerts
    };

    // Log to operations table
    const { error: logError } = await supabaseService
      .from('inventory_operations')
      .insert({
        operation_type: 'health_check',
        user_id: null,
        metadata: monitoringResult
      });

    if (logError) {
      console.warn('⚠️ Failed to log monitoring result:', logError);
    }

    // Output results
    if (alerts.length > 0) {
      console.log(`🚨 ${alerts.length} alert(s) detected:`);
      alerts.forEach(alert => {
        console.log(`  ${alert.level}: ${alert.message}`);
      });
    } else {
      console.log('✅ All inventory checks passed');
    }

    return new Response(
      JSON.stringify(monitoringResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('❌ Inventory monitor error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as any)?.message || 'Unknown error',
        error_code: 'MONITOR_FAILED'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});