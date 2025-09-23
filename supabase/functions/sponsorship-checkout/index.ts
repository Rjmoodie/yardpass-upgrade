import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the Authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { package_id, sponsor_id, notes } = await req.json();

    if (!package_id || !sponsor_id) {
      throw new Error('Missing required fields: package_id, sponsor_id');
    }

    // Verify user has permission to create orders for this sponsor
    const { data: membershipData, error: membershipError } = await supabase
      .from('sponsor_members')
      .select('role')
      .eq('sponsor_id', sponsor_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membershipData) {
      throw new Error('User does not have permission to create orders for this sponsor');
    }

    // Get package details
    const { data: packageData, error: packageError } = await supabase
      .from('sponsorship_packages')
      .select('*')
      .eq('id', package_id)
      .single();

    if (packageError || !packageData) {
      throw new Error('Package not found');
    }

    // Check inventory
    if (packageData.inventory <= 0) {
      throw new Error('Package is sold out');
    }

    // Create sponsorship order
    const { data: orderData, error: orderError } = await supabase
      .from('sponsorship_orders')
      .insert({
        package_id,
        sponsor_id,
        event_id: packageData.event_id,
        amount_cents: packageData.price_cents,
        notes: notes || null,
        status: 'pending'
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    // Log the sponsorship request
    console.log(`Sponsorship order created: ${orderData.id} for package ${package_id} by sponsor ${sponsor_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderData.id,
        amount_cents: orderData.amount_cents,
        status: orderData.status,
        message: 'Sponsorship request submitted successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in sponsorship-checkout:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'An unexpected error occurred',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});