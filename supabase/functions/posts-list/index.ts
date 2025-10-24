import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

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

    // ✅ FIX: Query event_posts directly with correct columns
    // Columns: id, event_id, author_user_id, text, media_urls, created_at, like_count, comment_count
    let query = supabaseClient
      .from('event_posts')
      .select('id, created_at, text, media_urls, author_user_id, like_count, comment_count, event_id')
      .is('deleted_at', null); // Only fetch non-deleted posts

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
      const tail = items[items.length - 1];
      const nextCursor = tail
        ? Buffer.from(`${new Date(tail.created_at).getTime()}:${tail.id}`, 'utf8').toString('base64')
        : undefined;

      // Optional: basic cache hints
      const response = createResponse({ items, nextCursor });
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

      const response = createResponse({ items: posts || [] });
      response.headers.set('Cache-Control', 'private, max-age=10');
      return response;
    }
  } catch (error) {
    console.error('Error in posts-list function:', error);
    return createErrorResponse(error?.message || 'Unknown error', 500);
  }
});
