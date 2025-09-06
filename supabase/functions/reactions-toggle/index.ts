import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

interface ToggleReactionRequest {
  post_id: string;
  kind?: string;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('Reactions-toggle function called');
    
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
    
    if (userError || !user) {
      return createErrorResponse("Unauthorized", 401);
    }

    const { post_id, kind = 'like' }: ToggleReactionRequest = await req.json();
    
    if (!post_id) {
      return createErrorResponse("Missing post_id", 400);
    }

    // Check if reaction exists
    const { data: existing } = await supabaseClient
      .from('event_reactions')
      .select('user_id')
      .eq('post_id', post_id)
      .eq('user_id', user.id)
      .eq('kind', kind)
      .maybeSingle();

    let isLiked: boolean;

    if (existing) {
      // Unlike - idempotent delete
      await supabaseClient
        .from('event_reactions')
        .delete()
        .eq('post_id', post_id)
        .eq('user_id', user.id)
        .eq('kind', kind);
      
      isLiked = false;
      console.log(`Removed ${kind} for post ${post_id} by user ${user.id}`);
    } else {
      // Like - idempotent insert
      await supabaseClient
        .from('event_reactions')
        .insert({
          post_id,
          user_id: user.id,
          kind
        });
      
      isLiked = true;
      console.log(`Added ${kind} for post ${post_id} by user ${user.id}`);
    }

    // Get updated like count
    const { data: post } = await supabaseClient
      .from('event_posts')
      .select('like_count')
      .eq('id', post_id)
      .single();

    return createResponse({
      liked: isLiked,
      like_count: post?.like_count || 0
    });

  } catch (error) {
    console.error('Error in reactions-toggle function:', error);
    return createErrorResponse(error.message, 500);
  }
});