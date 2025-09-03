import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const url = new URL(req.url);
    const event_id = url.searchParams.get('event_id');
    const user_id = url.searchParams.get('user_id');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

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
        user_profiles:author_user_id (
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
          owner_context_id
        ),
        event_reactions (
          kind,
          user_id
        ),
        event_comments (
          id,
          text,
          created_at,
          author_user_id,
          user_profiles:author_user_id (
            display_name,
            photo_url
          )
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
      return new Response(JSON.stringify({ error: postsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform the data to include computed fields
    const transformedPosts = posts?.map(post => ({
      ...post,
      like_count: post.event_reactions?.filter(r => r.kind === 'like').length || 0,
      comment_count: post.event_comments?.length || 0,
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
    })) || [];

    return new Response(JSON.stringify({ data: transformedPosts }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error in posts-list function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});