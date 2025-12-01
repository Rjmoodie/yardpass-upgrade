import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

interface CreatePostRequest {
  event_id: string;
  text?: string;
  media_urls?: string[];
  ticket_tier_id?: string;
  post_as_context_type?: string | null;
  post_as_context_id?: string | null;
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

    const { 
      event_id, 
      text, 
      media_urls = [], 
      ticket_tier_id,
      post_as_context_type,
      post_as_context_id
    }: CreatePostRequest = await req.json();
    console.log('Request data:', { 
      event_id, 
      text, 
      media_urls, 
      ticket_tier_id,
      post_as_context_type,
      post_as_context_id
    });

    if (!event_id || !text || typeof text !== "string") {
      return createErrorResponse("Missing event_id or text", 400);
    }

    // Fetch event details to check if it's a flashback
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('is_flashback, flashback_end_date')
      .eq('id', event_id)
      .single();

    if (eventError) {
      console.error('Error fetching event:', eventError);
      return createErrorResponse('Event not found', 404);
    }

    const isFlashback = event?.is_flashback || false;
    let processedText = text.trim();

    // FLASHBACK-SPECIFIC VALIDATION
    if (isFlashback) {
      // 1. Media required for flashbacks
      if (!media_urls || media_urls.length === 0) {
        return createErrorResponse(
          "Flashback posts require at least one photo or video",
          400
        );
      }

      // 2. Check if flashback posting is still open (90-day window)
      const { data: isOpen, error: openError } = await supabaseClient
        .rpc('is_flashback_posting_open', { p_event_id: event_id });

      if (openError || !isOpen) {
        return createErrorResponse(
          "Posting period for this Flashback event has ended",
          403
        );
      }

      // 3. Enforce 300 character limit for flashbacks
      if (processedText.length > 300) {
        return createErrorResponse(
          "Flashback captions are limited to 300 characters",
          400
        );
      }

      // 4. Strip links from flashback posts
      processedText = processedText.replace(/https?:\/\/[^\s]+/gi, '').trim();
      
      console.log('Flashback post validation passed', {
        original_length: text.length,
        processed_length: processedText.length,
        media_count: media_urls.length
      });
    } else {
      // Regular posts: 2000 character limit
      if (processedText.length > 2000) {
        return createErrorResponse("Text too long", 400);
      }
    }

    // Permission check using the corrected function
    const { data: canPost, error: permError } = await supabaseClient
      .rpc("can_current_user_post", { 
        p_event_id: event_id
      });

    console.log('Permission check result:', { canPost, permError, isFlashback });

    if (permError || !canPost) {
      const errorMessage = isFlashback
        ? "You must be signed in to post to this Flashback event"
        : "You must have a ticket or be an event organizer to post to this event";
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        requiresTicket: !isFlashback,
        requiresAuth: isFlashback
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

    // Validate post_as fields if provided
    if (post_as_context_type === 'organization') {
      if (!post_as_context_id) {
        return createErrorResponse("post_as_context_id is required when post_as_context_type is 'organization'", 400);
      }
      
      // Verify user is a member of the organization with posting rights
      const { data: membership, error: membershipError } = await supabaseClient
        .from('org_memberships')
        .select('role')
        .eq('org_id', post_as_context_id)
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin', 'editor'])
        .maybeSingle();
      
      if (membershipError) {
        console.error('Error checking org membership:', membershipError);
        return createErrorResponse('Failed to verify organization membership', 500);
      }
      
      if (!membership) {
        return createErrorResponse('You do not have permission to post as this organization', 403);
      }
      
      // Verify the organization exists
      const { data: org, error: orgError } = await supabaseClient
        .from('organizations')
        .select('id')
        .eq('id', post_as_context_id)
        .maybeSingle();
      
      if (orgError || !org) {
        return createErrorResponse('Organization not found', 404);
      }
    } else if (post_as_context_type !== null && post_as_context_type !== undefined) {
      return createErrorResponse(`Invalid post_as_context_type: ${post_as_context_type}`, 400);
    }

    // Create the post
    const { data: post, error: postError } = await supabaseClient
      .from('event_posts')
      .insert({
        event_id,
        author_user_id: user.id,
        text: processedText,  // Use processed text (links stripped for flashbacks)
        media_urls: media_urls || [],
        ticket_tier_id: finalTicketTierId,
        post_as_context_type: post_as_context_type || null,
        post_as_context_id: post_as_context_id || null,
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
    return createErrorResponse((error as any)?.message || 'Unknown error', 500);
  }
});