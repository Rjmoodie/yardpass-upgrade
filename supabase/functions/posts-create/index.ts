import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreatePostRequest {
  event_id: string;
  text?: string;
  media_urls?: string[];
  ticket_tier_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id, text, media_urls, ticket_tier_id }: CreatePostRequest = await req.json();

    // Validate that user can post to this event
    // Check if user has a ticket for this event OR is an event manager
    const { data: tickets } = await supabaseClient
      .from('tickets')
      .select('id, tier_id')
      .eq('event_id', event_id)
      .eq('owner_user_id', user.id)
      .in('status', ['issued', 'transferred', 'redeemed']);

    const { data: eventData } = await supabaseClient
      .from('events')
      .select('id, owner_context_type, owner_context_id')
      .eq('id', event_id)
      .single();

    // Check if user is event manager
    let canPost = false;
    if (eventData) {
      if (eventData.owner_context_type === 'individual' && eventData.owner_context_id === user.id) {
        canPost = true;
      } else if (eventData.owner_context_type === 'organization') {
        // Check org membership
        const { data: membership } = await supabaseClient
          .from('org_memberships')
          .select('role')
          .eq('org_id', eventData.owner_context_id)
          .eq('user_id', user.id)
          .single();
        
        if (membership && ['editor', 'admin', 'owner'].includes(membership.role)) {
          canPost = true;
        }
      }
    }

    // Check if user has tickets
    if (!canPost && tickets && tickets.length > 0) {
      canPost = true;
    }

    if (!canPost) {
      return new Response(JSON.stringify({ 
        error: "You must have a ticket or be an event organizer to post to this event",
        requiresTicket: true 
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine the ticket tier for badge display
    let finalTicketTierId = ticket_tier_id;
    if (!finalTicketTierId && tickets && tickets.length > 0) {
      // Use the highest tier ticket (assuming higher price = higher tier)
      const { data: tierData } = await supabaseClient
        .from('ticket_tiers')
        .select('id, price_cents')
        .in('id', tickets.map(t => t.tier_id))
        .order('price_cents', { ascending: false });
      
      if (tierData && tierData.length > 0) {
        finalTicketTierId = tierData[0].id;
      }
    }

    // Create the post
    const { data: post, error: postError } = await supabaseClient
      .from('event_posts')
      .insert({
        event_id,
        author_user_id: user.id,
        text: text || '',
        media_urls: media_urls || [],
        ticket_tier_id: finalTicketTierId,
      })
      .select()
      .single();

    if (postError) {
      console.error('Error creating post:', postError);
      return new Response(JSON.stringify({ error: postError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log('Post created successfully:', post);

    return new Response(JSON.stringify({ data: post }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error in posts-create function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});