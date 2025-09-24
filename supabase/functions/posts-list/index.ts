import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('Posts-list function called with URL:', req.url);
    
    const url = new URL(req.url);
    const eventId = url.searchParams.get("event_id");
    const authorId = url.searchParams.get("user_id");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);
    const cursor = url.searchParams.get("cursor"); // created_at|id format

    console.log('Query params:', { eventId, authorId, limit, cursor });

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

    const { data: { user } } = await supabaseClient.auth.getUser();

    // Build query using the new view
    let query = supabaseClient
      .from('event_posts_with_meta')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1); // Get one extra to check if there are more

    // Apply filters
    if (eventId) {
      query = query.eq('event_id', eventId);
    }
    if (authorId) {
      query = query.eq('author_user_id', authorId);
    }

    // Apply cursor pagination
    if (cursor) {
      const [cCreated, cId] = cursor.split("|");
      if (cCreated && cId) {
        query = query.or(`created_at.lt.${cCreated},and(created_at.eq.${cCreated},id.lt.${cId})`);
      }
    }

    const { data: posts, error: postsError } = await query;

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      return createErrorResponse(postsError.message, 500);
    }

    console.log(`Fetched ${posts?.length || 0} posts`);

    const items = posts || [];
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, -1) : items;
    const nextCursor = hasMore && page.length > 0
      ? `${page[page.length - 1].created_at}|${page[page.length - 1].id}`
      : null;

    // Get liked_by_me data for authenticated users
    let likedMap: Record<string, boolean> = {};
    if (user && page.length > 0) {
      const postIds = page.map(p => p.id);
      const { data: likes } = await supabaseClient
        .from('event_reactions')
        .select('post_id')
        .eq('user_id', user.id)
        .eq('kind', 'like')
        .in('post_id', postIds);

      likedMap = Object.fromEntries((likes || []).map(l => [l.post_id, true]));
    }

    // Transform data to include liked_by_me and author profile fields
    const transformedPosts = page.map(post => ({
      ...post,
      liked_by_me: !!likedMap[post.id],
      // Map badge_label for backward compatibility
      badge_label: post.author_badge_label || (
        post.author_is_organizer ? 'ORGANIZER' : null
      ),
      // Include computed fields for compatibility
      is_organizer: post.author_is_organizer,
      // Add author fields for profile routing
      author_id: post.author_user_id,
      author_display_name: post.author_name,
      author_is_organizer: post.author_is_organizer,
      // Ensure media_urls is always an array
      media_urls: post.media_urls || [],
      // Map other fields for frontend compatibility
      author_username: post.author_name,
      author_instagram: null,
      author_twitter: null,
      author_website: null
    }));

    console.log('🎯 Transformed posts with badges:', transformedPosts.map(p => ({ 
      author: p.author_name, 
      badge_label: p.badge_label, 
      author_badge_label: p.author_badge_label,
      is_organizer: p.is_organizer 
    })));

    return createResponse({
      data: transformedPosts,
      next_cursor: nextCursor,
      has_more: hasMore,
    });

  } catch (error) {
    console.error('Error in posts-list function:', error);
    return createErrorResponse((error as any)?.message || 'Unknown error', 500);
  }
});