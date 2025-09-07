import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    console.log("Starting get-home-feed request");
    
    const authHeader = req.headers.get("Authorization") ?? "";
    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !user) {
      console.error("Authentication failed:", userErr);
      return createErrorResponse("not_authenticated", 401);
    }

    console.log("User authenticated:", user.id);

    const { p_user_id, p_limit = 20, p_offset = 0 } = await req.json();

    // Get events where user is organizer or has tickets (for private events)
    const [orgEvents, ticketEvents] = await Promise.all([
      sbUser.from('events').select('id').eq('created_by', user.id),
      sbUser.from('tickets').select('event_id').eq('user_id', user.id).eq('status', 'issued')
    ]);

    const userRelatedEventIds = Array.from(new Set([
      ...(orgEvents.data || []).map(e => e.id),
      ...(ticketEvents.data || []).map(t => t.event_id)
    ]));

    console.log(`User is related to ${userRelatedEventIds.length} events`);

    // Use service role for efficient querying
    const sbSrv = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Build the query to show ALL public events + private events user is related to
    // This ensures posts are visible to everyone who should see them
    let query = sbSrv
      .from('events')
      .select(`
        id, title, description, start_at, end_at, venue, city, category, cover_image_url, visibility, created_by,
        user_profiles!events_created_by_fkey ( id, display_name, avatar_url ),
        ticket_tiers!ticket_tiers_event_id_fkey ( id, name, price_cents, badge_label, quantity ),
        event_posts (
          id, content, created_at, media_type, media_url, thumbnail_url, like_count, comment_count,
          user_profiles!event_posts_author_id_fkey ( id, display_name, avatar_url )
        )
      `)
      .or(`visibility.eq.public${userRelatedEventIds.length > 0 ? `,id.in.(${userRelatedEventIds.join(',')})` : ''}`);

    console.log(`Querying events with visibility: public events + ${userRelatedEventIds.length} user-related events`);

    // Add post ordering and limiting
    query = query
      .order('created_at', { foreignTable: 'event_posts', ascending: false })
      .limit(posts_per_event, { foreignTable: 'event_posts' });

    // Main event ordering
    if (sort_by_activity) {
      // For activity-based sorting, we'll do it client-side after fetching
      query = query.order('start_at', { ascending: true });
    } else {
      query = query.order('start_at', { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Events query error:", error);
      throw error;
    }

    if (!data || !data.length) {
      return createResponse({ events: [], totalCount: 0 }, 200);
    }

    // Get real attendee counts for each event
    const attendeeCounts = await Promise.all(
      data.map(async (event: any) => {
        const { count } = await sbSrv
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .eq('status', 'issued');
        return { eventId: event.id, count: count || 0 };
      })
    );

    const attendeeMap = new Map(attendeeCounts.map(ac => [ac.eventId, ac.count]));

    // Transform the data to match HomeFeedRow interface
    const transformed = data.map((e: any) => {
      const recentPosts = (e.event_posts || [])
        .filter((p: any) => p?.id)
        .map((post: any) => ({
          id: post.id,
          authorName: post.user_profiles?.display_name || null,
          authorUserId: post.user_profiles?.id || '',
          isOrganizer: post.user_profiles?.id === e.created_by,
          content: post.content || null,
          mediaUrls: post.media_url ? [post.media_url] : null,
          likes: post.like_count || 0,
          commentCount: post.comment_count || 0,
          createdAt: post.created_at
        }));

      // Calculate total posts and comments for this event
      const totalPosts = recentPosts.length;
      const totalComments = recentPosts.reduce((sum, post) => sum + post.commentCount, 0);

      return {
        id: e.id,
        title: e.title,
        description: e.description || null,
        category: e.category || null,
        cover_image_url: e.cover_image_url || null,
        start_at: e.start_at,
        end_at: e.end_at || null,
        venue: e.venue || null,
        city: e.city || null,
        created_by: e.created_by,
        total_posts: totalPosts,
        total_comments: totalComments,
        recent_posts: recentPosts
      };
    });

    console.log(`Successfully processed ${transformed.length} events with posts`);

    return createResponse(transformed, 200);

  } catch (e) {
    console.error("get-home-feed error:", e);
    return createErrorResponse(e?.message ?? "unknown_error", 500);
  }
});
