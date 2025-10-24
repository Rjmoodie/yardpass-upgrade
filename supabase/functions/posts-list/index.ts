import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

/**
 * Enrich posts with:
 * - liked_by_me: whether current user has liked the post
 * - is_organizer: whether author is event organizer
 * - Flattened author/event/tier data
 */
async function enrichPosts(posts: any[], currentUserId: string | undefined, supabase: any) {
  if (!posts || posts.length === 0) return [];

  const postIds = posts.map(p => p.id);

  // Batch fetch: Check which posts current user has liked
  let likedPostIds = new Set<string>();
  if (currentUserId) {
    const { data: reactions } = await supabase
      .from('events.event_reactions')
      .select('post_id')
      .in('post_id', postIds)
      .eq('user_id', currentUserId)
      .eq('kind', 'like');
    
    likedPostIds = new Set(reactions?.map((r: any) => r.post_id) || []);
  }

  // Transform and enrich each post
  return posts.map(post => {
    const author = post.user_profiles || {};
    const event = post.events || {};
    const tier = post.ticket_tiers || {};

    // Check if author is organizer
    const isOrganizer = 
      post.author_user_id === event.created_by ||
      (event.owner_context_type === 'individual' && post.author_user_id === event.owner_context_id);

    return {
      // Basic fields
      id: post.id,
      event_id: post.event_id,
      author_user_id: post.author_user_id,
      text: post.text || '',
      media_urls: post.media_urls || [],
      created_at: post.created_at,
      like_count: post.like_count ?? 0,
      comment_count: post.comment_count ?? 0,
      ticket_tier_id: post.ticket_tier_id,

      // Author data (flattened)
      author_name: author.display_name || 'User',
      author_display_name: author.display_name || 'User',
      author_photo_url: author.photo_url || null,
      author_username: author.username || null,
      author_instagram: author.instagram_handle || null,
      author_twitter: author.twitter_handle || null,
      author_website: author.website_url || null,

      // Badge/tier data
      badge_label: tier.badge_label || null,
      author_badge_label: tier.badge_label || null,
      tier_name: tier.name || null,

      // Organizer flag
      is_organizer: isOrganizer,
      author_is_organizer: isOrganizer,

      // Like status
      liked_by_me: likedPostIds.has(post.id),

      // Event data (flattened)
      event_title: event.title || 'Event',
      organizer_name: event.organizer_name || null,
      organizer_instagram: event.organizer_instagram || null,
      organizer_twitter: event.organizer_twitter || null,
      organizer_website: event.organizer_website || null,
    };
  });
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('Posts-list function called with URL:', req.url);
    const url = new URL(req.url);
    const eventId = url.searchParams.get("event_id");
    const authorId = url.searchParams.get("user_id");
    // 🔄 Backward-compatible pagination: support either page/limit OR cursor.
    const page = url.searchParams.get("page");
    const limit = parseInt(url.searchParams.get("limit") || "30", 10);
    const cursor = url.searchParams.get("cursor");

    console.log('Query params:', { eventId, authorId, limit, cursor, page });

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") }
        }
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    const currentUserId = user?.id;

    // ✅ COMPLETE FIX: Query event_posts with all required joins
    let query = supabaseClient
      .from('events.event_posts')
      .select(`
        id, 
        created_at, 
        text, 
        media_urls, 
        author_user_id, 
        like_count, 
        comment_count, 
        event_id,
        ticket_tier_id,
        user_profiles!event_posts_author_user_id_fkey (
          display_name,
          photo_url,
          username,
          instagram_handle,
          twitter_handle,
          website_url
        ),
        events!event_posts_event_id_fkey (
          title,
          organizer_name,
          organizer_instagram,
          organizer_twitter,
          organizer_website,
          owner_context_type,
          owner_context_id,
          created_by
        ),
        ticket_tiers!event_posts_ticket_tier_id_fkey (
          badge_label,
          name
        )
      `)
      .is('deleted_at', null);

    // Filter by event_id if provided
    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    // Filter by author_user_id if provided
    if (authorId) {
      query = query.eq('author_user_id', authorId);
    }

    if (cursor) {
      // Cursor format: base64("timestamp_ms:id")
      const raw = Buffer.from(String(cursor), 'base64').toString('utf8');
      const [tsMsStr, idStr] = raw.split(':');
      const ts = new Date(Number(tsMsStr));
      const lastId = idStr;

      const { data: posts, error: postsError } = await query
        .or(`created_at.lt.${ts.toISOString()},and(created_at.eq.${ts.toISOString()},id.lt.${lastId})`)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(Number(limit) + 1);

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        return createErrorResponse(postsError.message, 500);
      }

      const hasMore = posts && posts.length > Number(limit);
      const items = hasMore ? posts.slice(0, Number(limit)) : (posts || []);
      
      // ✅ Enrich posts with liked_by_me and is_organizer
      const enrichedItems = await enrichPosts(items, currentUserId, supabaseClient);
      
      const tail = enrichedItems[enrichedItems.length - 1];
      const nextCursor = tail
        ? Buffer.from(`${new Date(tail.created_at).getTime()}:${tail.id}`, 'utf8').toString('base64')
        : undefined;

      // Optional: basic cache hints
      const response = createResponse({ data: enrichedItems, nextCursor });
      response.headers.set('Cache-Control', 'private, max-age=10');
      return response;
    } else {
      // Legacy path: still supported
      const safeLimit = Math.min(Number(limit), 50);
      const safePage = Math.max(Number(page ?? 1), 1);
      const offset = (safePage - 1) * safeLimit;

      const { data: posts, error: postsError } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + safeLimit - 1);

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        return createErrorResponse(postsError.message, 500);
      }

      // ✅ Enrich posts with liked_by_me and is_organizer
      const enrichedItems = await enrichPosts(posts || [], currentUserId, supabaseClient);

      const response = createResponse({ data: enrichedItems });
      response.headers.set('Cache-Control', 'private, max-age=10');
      return response;
    }
  } catch (error) {
    console.error('Error in posts-list function:', error);
    return createErrorResponse(error?.message || 'Unknown error', 500);
  }
});
