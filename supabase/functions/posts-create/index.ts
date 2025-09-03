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
    console.log('Posts-create function called with body:', await req.clone().text());
    
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
    console.log('User auth result:', { user: user?.id, error: userError });
    
    if (userError || !user) {
      console.log('Authentication failed');
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_id, text, media_urls, ticket_tier_id }: CreatePostRequest = await req.json();
    console.log('Request data:', { event_id, text, media_urls, ticket_tier_id });

    // Validate that user can post to this event
    // Check if user has a ticket for this event OR is an event manager
    console.log('Checking user tickets...');
    const { data: tickets, error: ticketsError } = await supabaseClient
      .from('tickets')
      .select('id, tier_id')
      .eq('event_id', event_id)
      .eq('owner_user_id', user.id)
      .in('status', ['issued', 'transferred', 'redeemed']);

    console.log('User tickets:', tickets, 'Error:', ticketsError);

    console.log('Checking event data...');
    const { data: eventData, error: eventError } = await supabaseClient
      .from('events')
      .select('id, owner_context_type, owner_context_id')
      .eq('id', event_id)
      .single();

    console.log('Event data:', eventData, 'Error:', eventError);

    // Check if user is event manager
    let canPost = false;
    console.log('Checking if user can post...');
    
    if (eventData) {
      if (eventData.owner_context_type === 'individual' && eventData.owner_context_id === user.id) {
        console.log('User is individual event owner');
        canPost = true;
      } else if (eventData.owner_context_type === 'organization') {
        console.log('Checking org membership...');
        // Check org membership
        const { data: membership } = await supabaseClient
          .from('org_memberships')
          .select('role')
          .eq('org_id', eventData.owner_context_id)
          .eq('user_id', user.id)
          .single();
        console.log('Org membership:', membership);
        if (membership && ['editor', 'admin', 'owner'].includes(membership.role)) {
          console.log('User has org permissions');
          canPost = true;
        }
      }
    } else {
      console.log('No event data found for event_id:', event_id);
    }

    // Check if user has tickets
    if (!canPost && tickets && tickets.length > 0) {
      console.log('User has tickets, can post');
      canPost = true;
    }

    console.log('Final canPost decision:', canPost);

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