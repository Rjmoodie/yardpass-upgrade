import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('Posts-list function called with URL:', req.url);
    
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

    const url = new URL(req.url);
    const event_id = url.searchParams.get('event_id');
    const user_id = url.searchParams.get('user_id');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    console.log('Query params:', { event_id, user_id, limit, offset });

    let query = supabaseClient
      .from('event_posts')
      .select(`
        id,
        text,
        media_urls,
        created_at,
        author_user_id,
        event_id,
        ticket_tier_id,
        user_profiles!event_posts_author_user_id_fkey (
          display_name,
          photo_url
        ),
        ticket_tiers:ticket_tier_id (
          badge_label,
          name
        ),
        events:event_id (
          title,
          owner_context_type,
          owner_context_id,
          visibility
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by event or user if specified
    if (event_id) {
      query = query.eq('event_id', event_id);
    }
    if (user_id) {
      query = query.eq('author_user_id', user_id);
    }

    const { data: posts, error: postsError } = await query;

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      return createErrorResponse(postsError.message, 500);
    }

    console.log(`Fetched ${posts?.length || 0} posts`);

    // Get reaction counts and comments for each post
    if (posts && posts.length > 0) {
      const postIds = posts.map(p => p.id);
      
      // Get reaction counts
      const { data: reactions } = await supabaseClient
        .from('event_reactions')
        .select('post_id, kind')
        .in('post_id', postIds);

      // Get comment counts  
      const { data: comments } = await supabaseClient
        .from('event_comments')
        .select('post_id')
        .in('post_id', postIds);

      // Transform the data to include computed fields
      const transformedPosts = posts.map(post => {
        const postReactions = reactions?.filter(r => r.post_id === post.id) || [];
        const postComments = comments?.filter(c => c.post_id === post.id) || [];
        
        return {
          ...post,
          like_count: postReactions.filter(r => r.kind === 'like').length,
          comment_count: postComments.length,
          is_organizer: post.events && (
            (post.events.owner_context_type === 'individual' && post.events.owner_context_id === post.author_user_id) ||
            (post.events.owner_context_type === 'organization')
          ),
          badge_label: post.ticket_tiers?.badge_label || (
            post.events && post.events.owner_context_type === 'individual' && post.events.owner_context_id === post.author_user_id 
              ? 'HOST' 
              : post.events && post.events.owner_context_type === 'organization' 
                ? 'CREW' 
                : null
          )
        };
      });

      return createResponse({ data: transformedPosts });
    }

    return createResponse({ data: [] });

  } catch (error) {
    console.error('Error in posts-list function:', error);
    return createErrorResponse(error.message, 500);
  }
});