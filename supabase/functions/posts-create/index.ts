import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

interface CreatePostRequest {
  event_id: string;
  text?: string;
  media_urls?: string[];
  ticket_tier_id?: string;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('Posts-create function called');
    
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

    // Idempotency and rate limiting are optional - skip if tables don't exist
    // These can be enabled later by creating the required tables

    const { 
      event_id, 
      text, 
      media_urls = [], 
      ticket_tier_id
    }: CreatePostRequest = await req.json();
    console.log('Request data:', { event_id, text, media_urls, ticket_tier_id });

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

    // Create the post - only include fields that exist in the table
    const postData: Record<string, unknown> = {
      event_id,
      author_user_id: user.id,
      text: processedText,  // Use processed text (links stripped for flashbacks)
      media_urls: media_urls || [],
    };
    
    // Only include ticket_tier_id if provided
    if (finalTicketTierId) {
      postData.ticket_tier_id = finalTicketTierId;
    }

    const { data: post, error: postError } = await supabaseClient
      .from('event_posts')
      .insert(postData)
      .select('id')
      .single();

    if (postError) {
      console.error('Error creating post:', postError);
      return createErrorResponse(postError.message, 500);
    }

    console.log('Post created successfully:', post);

    // Fetch author details for feed format
    const { data: author } = await supabaseClient
      .from('user_profiles')
      .select('display_name, username, photo_url')
      .eq('user_id', user.id)
      .maybeSingle();

    // Fetch event details
    const { data: eventDetails } = await supabaseClient
      .from('events')
      .select('id, title, cover_image_url')
      .eq('id', event_id)
      .maybeSingle();

    // Fetch ticket tier details if provided
    let ticketTier = null;
    if (finalTicketTierId) {
      const { data: tier } = await supabaseClient
        .from('ticket_tiers')
        .select('id, name, badge_label')
        .eq('id', finalTicketTierId)
        .maybeSingle();
      
      if (tier) {
        ticketTier = {
          id: tier.id,
          name: tier.name,
          badge_label: tier.badge_label,
        };
      }
    }

    // Transform to FeedItemPost format (matches src/types/api.ts)
    const feedPost = {
      item_type: 'post',
      item_id: post.id,
      event_id: event_id,
      created_at_ts: new Date().getTime(),
      
      author: {
        id: user.id,
        display_name: author?.display_name || 'Anonymous',
        username: author?.username || null,
        photo_url: author?.photo_url || null,
      },
      
      content: {
        text: processedText,
        media: (media_urls || []).map((url: string) => {
          const isVideo = url.startsWith('mux:');
          const playbackId = isVideo ? url.slice(4) : null;
          
          return {
            url,
            type: isVideo ? 'video' : 'image',
            thumbnail: isVideo 
              ? `https://image.mux.com/${playbackId}/thumbnail.jpg`
              : url,
          };
        }),
      },
      
      metrics: {
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
        viewer_has_liked: false,
      },
      
      event: eventDetails ? {
        id: eventDetails.id,
        title: eventDetails.title,
        cover_image_url: eventDetails.cover_image_url,
      } : null,
      
      processing: {
        status: 'ready', // Assume ready for now, Mux webhook will update if processing
      },
      
      ticket_tier: ticketTier,
    };

    return createResponse({ 
      success: true,
      post: feedPost,
      event_title: eventDetails?.title || ''
    }, 201);

  } catch (error) {
    console.error('Error in posts-create function:', error);
    return createErrorResponse((error as any)?.message || 'Unknown error', 500);
  }
});