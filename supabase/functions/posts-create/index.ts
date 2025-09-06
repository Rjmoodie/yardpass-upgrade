import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

interface CreatePostRequest {
  event_id: string;
  text?: string;
  media_urls?: string[];
  ticket_tier_id?: string;
}

const RATELIMIT_MAX_PER_MIN = 10;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('Posts-create function called');
    
    // Create service role client for idempotency and rate limiting
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    
    // Create Supabase client for user operations
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
      return createErrorResponse("Unauthorized", 401);
    }

    // Check for idempotency key
    const idempotencyKey = req.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const { data: existing } = await serviceClient
        .from('idempotency_keys')
        .select('response')
        .eq('key', idempotencyKey)
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existing) {
        console.log('Returning cached response for idempotency key:', idempotencyKey);
        return createResponse(existing.response);
      }
    }
    
    // Rate limiting
    const now = new Date();
    const minute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
    
    const { data: rateCheck } = await serviceClient
      .from('rate_limits')
      .upsert({ 
        user_id: user.id, 
        bucket: 'posts-create', 
        minute: minute.toISOString(),
        count: 1 
      }, { 
        onConflict: 'user_id,bucket,minute',
        count: 'exact'
      })
      .select('count')
      .maybeSingle();
      
    if (rateCheck && rateCheck.count > RATELIMIT_MAX_PER_MIN) {
      return createErrorResponse('Rate limit exceeded', 429);
    }

    const { event_id, text, media_urls = [], ticket_tier_id }: CreatePostRequest = await req.json();
    console.log('Request data:', { event_id, text, media_urls, ticket_tier_id });

    if (!event_id || !text || typeof text !== "string") {
      return createErrorResponse("Missing event_id or text", 400);
    }
    if (text.length > 2000) {
      return createErrorResponse("Text too long", 400);
    }

    // Permission check using the new function
    const { data: canPost, error: permError } = await supabaseClient
      .rpc("can_current_user_post", { 
        target_event_id: event_id, 
        uid: user.id 
      });

    console.log('Permission check result:', { canPost, permError });

    if (permError || !canPost) {
      return new Response(JSON.stringify({ 
        error: "You must have a ticket or be an event organizer to post to this event",
        requiresTicket: true 
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Derive author's badge (if not provided)
    let finalTicketTierId = ticket_tier_id;
    if (!finalTicketTierId) {
      const { data: tickets } = await supabaseClient
        .from('tickets')
        .select('tier_id')
        .eq('event_id', event_id)
        .eq('owner_user_id', user.id)
        .in('status', ['issued', 'transferred', 'redeemed'])
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (tickets && tickets.length > 0) {
        finalTicketTierId = tickets[0].tier_id;
      }
    }

    // Create the post
    const { data: post, error: postError } = await supabaseClient
      .from('event_posts')
      .insert({
        event_id,
        author_user_id: user.id,
        text: text.trim(),
        media_urls: media_urls || [],
        ticket_tier_id: finalTicketTierId,
      })
      .select('id')
      .single();

    if (postError) {
      console.error('Error creating post:', postError);
      return createErrorResponse(postError.message, 500);
    }

    console.log('Post created successfully:', post);

    // Fetch from the new view for rich metadata
    const { data: fullPost, error: viewError } = await supabaseClient
      .from('event_posts_with_meta')
      .select('*')
      .eq('id', post.id)
      .maybeSingle();

    if (viewError) {
      console.error('Error fetching post metadata:', viewError);
      // Fallback to basic post data
      return createResponse({ data: post }, 201);
    }

    const responseData = { data: fullPost };
    
    // Cache successful response for idempotency
    if (idempotencyKey) {
      await serviceClient
        .from('idempotency_keys')
        .insert({
          key: idempotencyKey,
          user_id: user.id,
          response: responseData
        })
        .select()
        .maybeSingle();
    }

    return createResponse(responseData, 201);

  } catch (error) {
    console.error('Error in posts-create function:', error);
    return createErrorResponse(error.message, 500);
  }
});